// components/MainContainer/MainContainer.jsx
import React from 'react';
import styles from './MainContainer.module.css';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import Sidebar from '../Sidebar/Sidebar';
import Notification from '../Notification/Notification';
import { useSidebar } from '../../contexts/SidebarProvider';

const MainContainer = ({ children, showSidebar = true }) => {
  const { isCollapsed } = useSidebar();

  return (
    <>
      <Notification />
      <div className={styles.toggleWrapper}>
        <ThemeToggle />
      </div>
      {showSidebar && <Sidebar />}
      <div
        className={styles.mainContainer}
        style={{
          marginLeft: showSidebar ? (isCollapsed ? '72px' : '260px') : 0,
          width: showSidebar ? (isCollapsed ? 'calc(100% - 72px)' : 'calc(100% - 260px)') : '100%'
        }}
      >
        {children}
      </div>
    </>
  );
};

export default MainContainer;

