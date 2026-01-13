// contexts/AppProviders.jsx
import React from 'react';
import ThemeProvider from './ThemeProvider';
import NotificationProvider from './NotificationProvider';
import LoaderProvider from './LoaderProvider';
import SidebarProvider from './SidebarProvider';
import AuthProvider from './AuthProvider';

const AppProviders = ({ children }) => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <LoaderProvider>
            <SidebarProvider>
              {children}
            </SidebarProvider>
          </LoaderProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default AppProviders;

