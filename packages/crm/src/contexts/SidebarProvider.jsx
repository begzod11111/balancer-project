// contexts/SidebarProvider.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const SidebarContext = createContext();

export const SidebarProvider = ({ children }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(!prev));
      return !prev;
    });
  };

  const showSidebar = () => setIsVisible(true);
  const hideSidebar = () => setIsVisible(false);

  return (
    <SidebarContext.Provider value={{
      isVisible,
      isCollapsed,
      toggleCollapse,
      showSidebar,
      hideSidebar
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
};

export default SidebarProvider;
