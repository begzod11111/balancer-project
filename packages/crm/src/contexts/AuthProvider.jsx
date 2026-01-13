import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../utilities/urls';

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkTokenAuth = useCallback(async (token, signal) => {
    if (!token) return false;
    try {
      const res = await axios.post(URLS.VERIFY_TOKEN, { token }, { signal });
      // адаптировать поле в ответе под ваш API
      return res.status === 200 && !!(res.data?.tokenValid ?? res.data?.valid);
    } catch (err) {
      // axios cancellation: name === 'CanceledError' или code === 'ERR_CANCELED'
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.message === 'canceled') {
        return false;
      }
      console.error('Token verification error', err);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    (async () => {
      if (!isMounted) return;
      setIsLoading(true);

      const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (!token) {
        if (!isMounted) return;
        setUser(null);
        setAccessToken(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const isValid = await checkTokenAuth(token, controller.signal);

      if (!isMounted || controller.signal.aborted) return;

      if (isValid) {
        setAccessToken(token);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            console.warn('Invalid saved user JSON', e);
            setUser(null);
          }
        }
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setAccessToken(null);
        setIsAuthenticated(false);
        ['user', 'accessToken', 'refreshToken', 'userEmail'].forEach(key => {
          try {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          } catch (e) {
            // игнорировать ошибки хранилища
          }
        });
      }

      if (isMounted) setIsLoading(false);
    })();

    return () => {
      isMounted = false;
      try {
        controller.abort();
      } catch (e) {
        // ignore
      }
    };
    // пустой массив зависимостей — эффект запускается при монтировании
  }, [checkTokenAuth]);

  const login = useCallback((data, rememberMe = false) => {
    const { user: u, accessToken: token, refreshToken } = data;
    const storage = rememberMe ? localStorage : sessionStorage;

    setUser(u);
    setAccessToken(token);
    setIsAuthenticated(true);

    try {
      storage.setItem('user', JSON.stringify(u));
      storage.setItem('accessToken', token);
      storage.setItem('refreshToken', refreshToken);
      if (rememberMe && u?.email) {
        localStorage.setItem('userEmail', u.email);
      }
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setIsAuthenticated(false);

    ['user', 'accessToken', 'refreshToken', 'userEmail'].forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        // игнор
      }
    });
  }, []);

  const getToken = useCallback(() => {
    return accessToken ||
           localStorage.getItem('accessToken') ||
           sessionStorage.getItem('accessToken') ||
           null;
  }, [accessToken]);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      isAuthenticated,
      isLoading,
      login,
      logout,
      getToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthProvider;
