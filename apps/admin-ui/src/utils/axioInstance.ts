import axios from "axios";

// Use empty baseURL so requests go through Next.js rewrites (which correctly proxy cookies)
// Seller UI rewrites: /api/* -> gateway/api/*, /product/* -> gateway/product/*
const axiosInstance = axios.create({
  baseURL: typeof window !== "undefined" ? "" : "http://localhost:8080",
  withCredentials: true,
  timeout: 12000,
});

let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"];

// Handle logout and prevent infinite loops
const handleLogout = () => {
  const currentPath = window.location.pathname;
  const isPublicRoute = currentPath === "/" || PUBLIC_ROUTES.some((route) =>
    currentPath.startsWith(route),
  );
  if (!isPublicRoute) {
    window.location.href = "/login";
  }
};

// Handle adding a new access token to queued requests
const subscribeTokenRefresh = (
  resolve: () => void,
  reject: (error: unknown) => void,
) => {
  refreshSubscribers.push({ resolve, reject });
};

// Execute queued requests after refresh
const onRefreshSuccess = () => {
  refreshSubscribers.forEach(({ resolve }) => resolve());
  refreshSubscribers = [];
};

const onRefreshFailure = (error: unknown) => {
  refreshSubscribers.forEach(({ reject }) => reject(error));
  refreshSubscribers = [];
};

// Handle API requests
axiosInstance.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
);

// Handle expired tokens and refresh token
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite retry loop — skip refresh on public routes
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "";
    const isPublicRoute = currentPath === "/" || PUBLIC_ROUTES.some((route) =>
      currentPath.startsWith(route),
    );
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isPublicRoute
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            () => resolve(axiosInstance(originalRequest)),
            reject,
          );
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        await axios.post(
          `/api/refresh-token`,
          {},
          { withCredentials: true },
        );

        isRefreshing = false;
        onRefreshSuccess();

        return axiosInstance(originalRequest);
      } catch (error) {
        isRefreshing = false;
        onRefreshFailure(error);
        handleLogout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
