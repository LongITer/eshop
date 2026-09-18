import type { AxiosRequestConfig } from "axios";

/**
 * Axios config to use for authenticated (protected) requests.
 * Pass this as the config argument in axiosInstance calls to ensure
 * credentials (cookies) are included.
 *
 * Usage:
 *   axiosInstance.post("/api/some-protected-route", data, isProtected)
 *   axiosInstance.get("/api/some-protected-route", isProtected)
 */
const isProtected: AxiosRequestConfig = {
  withCredentials: true,
};

export default isProtected;
