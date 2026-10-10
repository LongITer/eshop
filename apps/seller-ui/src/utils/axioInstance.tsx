import axios from 'axios';
const axiosInstance = axios.create({
  baseURL: typeof window !== 'undefined' ? '' : (process.env.GATEWAY_INTERNAL_URL || 'http://localhost:8080'),
  withCredentials: true,
  headers: { 'X-Session-Role': 'seller' },
});
let refresh: Promise<unknown> | null = null;
axiosInstance.interceptors.response.use(response => response, async error => {
  const request = error.config;
  if (error.response?.status !== 401 || !request || request._retry || typeof window === 'undefined' || /\/(login-seller|seller-refresh-token|seller-registration|verify-seller)(?:\?|$)/.test(request.url || '')) throw error;
  request._retry = true;
  try {
    refresh ??= axios.post('/api/seller-refresh-token', {}, { withCredentials: true }).finally(() => { refresh = null; });
    await refresh;
    return await axiosInstance(request);
  } catch (refreshError) {
    if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401 && !/^\/(login|signup|forgot-password)(\/|$)/.test(window.location.pathname)) window.location.assign('/login');
    throw refreshError;
  }
});
export default axiosInstance;
