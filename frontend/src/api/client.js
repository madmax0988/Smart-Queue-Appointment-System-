import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

client.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshingPromise = null;

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (response?.status === 401 && !config._retried) {
      config._retried = true;
      const { refreshToken, setSession, clearSession } = useAuthStore.getState();
      if (!refreshToken) {
        clearSession();
        return Promise.reject(error);
      }
      try {
        if (!refreshingPromise) {
          refreshingPromise = axios
            .post(`${client.defaults.baseURL}/auth/refresh`, { refreshToken })
            .finally(() => { refreshingPromise = null; });
        }
        const { data } = await refreshingPromise;
        setSession(data.data.user, data.data.accessToken, data.data.refreshToken);
        config.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return client(config);
      } catch (refreshErr) {
        clearSession();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message;
  if (!error?.response) return 'Could not reach the server. Please check your connection and try again.';
  return error?.message || 'Something went wrong. Please try again.';
}

export default client;
