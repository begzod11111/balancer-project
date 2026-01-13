import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthProvider';
import { useNotification } from '../../contexts/NotificationProvider';

const ProtectedRoute = ({ children }) => {
  const { getToken } = useAuth();
  const { notify } = useNotification();
  const token = getToken();

  if (!token) {
    notify.error('Необходима авторизация');
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
