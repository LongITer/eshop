import axios from "axios";

const axiosInstance = axios.create({
    baseURL: "",
    withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers: (() => void)[] = []

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password"];

// Handle logout and prevent infinite loops
const handleLogout = () => {
    const currentPath = window.location.pathname;
    const isPublicRoute = PUBLIC_ROUTES.some((route) => currentPath.startsWith(route));
    if (!isPublicRoute) {
        window.location.href = "/login";
    }
}

// Handle adding a new access token to queued requests
const subscribeTokenRefresh = (callback: () => void) => {
    refreshSubscribers.push(callback);
}

// Execute queued requests after refresh
const onRefreshSuccess = () => {
    refreshSubscribers.forEach((callback) => callback());
    refreshSubscribers = [];
}

// Handle API requests
axiosInstance.interceptors.request.use(
    (config) => config,
    (error) => Promise.reject(error)
)

// Handle expired tokens and refresh token
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Prevent infinite retry loop — skip refresh on public routes
        const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
        const isPublicRoute = PUBLIC_ROUTES.some((route) => currentPath.startsWith(route));
        if (error.response?.status === 401 && !originalRequest._retry && !isPublicRoute) {
            if (isRefreshing) {
                return new Promise((resolve) => {
                    subscribeTokenRefresh(() => resolve(axiosInstance(originalRequest)))
                })
            }
            originalRequest._retry = true;
            isRefreshing = true;
            try {
                await axios.post(
                    `/api/seller-refresh-token`,
                    {},
                    { withCredentials: true }
                );

                isRefreshing = false;
                onRefreshSuccess();

                return axiosInstance(originalRequest)
            } catch (error) {
                isRefreshing = false;
                refreshSubscribers = [];
                handleLogout();
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
)

export default axiosInstance;