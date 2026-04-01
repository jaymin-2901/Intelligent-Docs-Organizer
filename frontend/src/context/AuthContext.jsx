import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  const getToken = () =>
    localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

  const clearStorage = () => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
  };

  const storeToken = (token, rememberMe) =>
    (rememberMe ? localStorage : sessionStorage).setItem('authToken', token);

  // Boot: restore session
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { data } = await authAPI.getMe();
          if (data.success) setUser(data.user);
          else clearStorage();
        } catch { clearStorage(); }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email, password, rememberMe = false) => {
    const { data } = await authAPI.login({ email, password, rememberMe });
    if (data.success) { storeToken(data.token, rememberMe); setUser(data.user); }
    return data;
  }, []);

  const signup = useCallback(async (formData) => {
    const { data } = await authAPI.signup(formData);
    if (data.success) { storeToken(data.token, false); setUser(data.user); }
    return data;
  }, []);

  const logout = useCallback(() => { clearStorage(); setUser(null); }, []);

  const updateUser = useCallback((u) => setUser(u), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
