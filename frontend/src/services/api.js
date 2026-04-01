import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  signup:         (d) => API.post('/auth/signup', d),
  login:          (d) => API.post('/auth/login', d),
  getMe:          ()  => API.get('/auth/me'),
  updateProfile:  (d) => API.put('/auth/profile', d),
  changePassword: (d) => API.put('/auth/change-password', d),
  forgotPassword: (d) => API.post('/auth/forgot-password', d),
  resetPassword:  (t, d) => API.post(`/auth/reset-password/${t}`, d),
};

export default API;
