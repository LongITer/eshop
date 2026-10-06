import axios from "axios";

const axiosInstance = axios.create({
  baseURL: typeof window !== "undefined" ? "" : (process.env.GATEWAY_INTERNAL_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:8080"),
  withCredentials: true,
});

// One shared promise settles every concurrent request, including refresh failures.
let refresh: Promise<unknown> | null = null;
axiosInstance.interceptors.response.use(response => response, async error => {
  const request = error.config;
  if (error.response?.status !== 401 || !request || request._retry || typeof window === "undefined") {
    return Promise.reject(error);
  }
  if (/\/(login-user|refresh-token|user-registration|verify-user|forgot-password-user|reset-password-user)/.test(request.url ?? "")) {
    return Promise.reject(error);
  }
  request._retry = true;
  try {
    refresh ??= axios.post("/api/refresh-token", {}, { withCredentials: true }).finally(() => { refresh = null; });
    await refresh;
    // Await the retried request so a rejected session reaches the handler below.
    return await axiosInstance(request);
  } catch (refreshError) {
    // Browsing products, cart and wishlist remains available to guests.
    if (/^\/(profile|inbox|notifications|order|checkout|payment-success)(\/|$)/.test(window.location.pathname)) {
      window.location.assign("/login");
    }
    return Promise.reject(refreshError);
  }
});

export default axiosInstance;
