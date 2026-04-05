import axios from 'axios';

const getStoredToken = () =>
  localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
API.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/signup');

    if (status === 401 && !isAuthRequest && getStoredToken()) {
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

const extractDocs = (payload) => payload?.data || payload?.documents || [];

const buildCategorySummary = (docs = []) => {
  const bucket = new Map();

  for (const doc of docs) {
    const main = doc.main_category || doc.category || 'Uncategorized';
    const sub = doc.sub_category || null;

    if (!bucket.has(main)) {
      bucket.set(main, {
        name: main,
        documentCount: 0,
        subCategories: new Map(),
      });
    }

    const entry = bucket.get(main);
    entry.documentCount += 1;

    if (sub) {
      const subCount = entry.subCategories.get(sub) || 0;
      entry.subCategories.set(sub, subCount + 1);
    }
  }

  return Array.from(bucket.values())
    .map((x) => ({
      name: x.name,
      documentCount: x.documentCount,
      subCategories: Array.from(x.subCategories.entries()).map(([name, count]) => ({
        name,
        documentCount: count,
      })),
    }))
    .sort((a, b) => b.documentCount - a.documentCount);
};

export const authAPI = {
  signup:         (d) => API.post('/auth/signup', d),
  login:          (d) => API.post('/auth/login', d),
  getMe:          ()  => API.get('/auth/me'),
  updateProfile:  (d) => API.put('/auth/profile', d),
  changePassword: (d) => API.put('/auth/change-password', d),
  forgotPassword: (d) => API.post('/auth/forgot-password', d),
  resetPassword:  (t, d) => API.post(`/auth/reset-password/${t}`, d),
};

export const getDocuments = async (mainCategory = null, subCategory = null) => {
  const { data } = await API.get('/documents');
  let documents = extractDocs(data);

  if (mainCategory) {
    documents = documents.filter((d) => (d.main_category || d.category) === mainCategory);
  }
  if (subCategory) {
    documents = documents.filter((d) => d.sub_category === subCategory);
  }

  return { success: true, data: documents };
};

export const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('document', file);

  const { data } = await API.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
};

export const searchDocuments = async (query) => {
  const q = (query || '').trim().toLowerCase();
  const all = await getDocuments();

  if (!q) return all;

  const filtered = all.data.filter((doc) => {
    const haystack = [
      doc.original_name,
      doc.file_name,
      doc.main_category,
      doc.sub_category,
      ...(Array.isArray(doc.keywords) ? doc.keywords : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });

  return { success: true, data: filtered };
};

export const toggleBookmark = async (docId) => {
  const { data } = await API.put(`/documents/${docId}/bookmark`);
  return data;
};

export const deleteDocument = async (docId) => {
  const { data } = await API.delete(`/documents/${docId}`);
  return data;
};

export const getCategories = async () => {
  try {
    const { data } = await API.get('/documents/meta/categories');
    const categories = data?.data || data?.categories || [];

    if (categories.length > 0) {
      return {
        success: true,
        data: categories.map((c) => ({
          name: c.name,
          documentCount: c.documentCount ?? c.count ?? 0,
          subCategories: c.subCategories || [],
        })),
      };
    }
  } catch (_) {
    // Fallback to derived categories from documents.
  }

  const docs = await getDocuments();
  return { success: true, data: buildCategorySummary(docs.data) };
};

export const recordAnalyticsEvent = async (event) => {
  const { data } = await API.post('/analytics/event', event);
  return data;
};

export const getAuthToken = getStoredToken;

export default API;
