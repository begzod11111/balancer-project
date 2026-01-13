// contexts/NotificationProvider.jsx
import React, { createContext, useState, useCallback, useContext } from 'react';

export const NotificationContext = createContext();

const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState({
    message: '',
    type: '',
    has: false
  });

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type, has: true });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, has: false }));
  }, []);

  const notify = {
    success: (message) => showNotification(message, 'success'),
    error: (message) => showNotification(message, 'error'),
    warning: (message) => showNotification(message, 'warning'),
    info: (message) => showNotification(message, 'info')
  };

  return (
    <NotificationContext.Provider value={{
      notification,
      setNotification,
      notify,
      hideNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export default NotificationProvider;
