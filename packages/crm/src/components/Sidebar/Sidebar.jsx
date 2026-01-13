// components/Sidebar/Sidebar.jsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarProvider';
import { useAuth } from '../../contexts/AuthProvider';
import {
  IoGrid,
  IoPeople,
  IoFolder,
  IoCheckboxOutline,
  IoAnalytics,
  IoChatbubbles,
  IoSettings,
  IoLogOut,
  IoChevronBack,
  IoPerson
} from 'react-icons/io5';
import styles from './Sidebar.module.css';

const menuItems = [
    {id: 'dashboard', label: 'Дашборд', path: '/dashboard', icon: IoGrid},
    {id: 'users', label: 'Пользователи', path: '/users', icon: IoPeople},
    {id: 'projects', label: 'Проекты', path: '/projects', icon: IoFolder},
    {id: 'tasks', label: 'Задачи', path: '/tasks', icon: IoCheckboxOutline},
    {id: 'analytics', label: 'Аналитика', path: '/analytics', icon: IoAnalytics},
    {id: 'messages', label: 'Сообщения', path: '/messages', icon: IoChatbubbles, badge: 3},
    {id: 'settings', label: 'Настройки', path: '/settings', icon: IoSettings},
    {id: "shifts", label: "Смены", path: "/shifts", icon: IoPeople},
    {id: "departments", label: "Отделы", path: "/departments", icon: IoPeople},
    {id: "types", label: "Типы", path: "/types", icon: IoPeople},
    {id: "pool", label: "Поток", path: "/pool", icon: IoPeople},
];

const Sidebar = () => {
  const { isVisible, isCollapsed, toggleCollapse } = useSidebar();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isVisible) return null;

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfile = () => {
    navigate('/profile');
  };

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logoWrapper} onClick={() => navigate('/dashboard')}>
          <div className={styles.logoIcon}>
            <img src="/distribution.png" alt="Logo" />
          </div>
          {!isCollapsed && <span className={styles.logoText}>CRM</span>}
        </div>
        <button
          className={styles.collapseBtn}
          onClick={toggleCollapse}
          title={isCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          <IoChevronBack className={isCollapsed ? styles.rotated : ''} />
        </button>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <ul className={styles.menu}>
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  className={`${styles.menuItem} ${isActive(item.path) ? styles.active : ''}`}
                  onClick={() => navigate(item.path)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className={styles.icon}>
                    <Icon />
                  </span>
                  {!isCollapsed && (
                    <>
                      <span className={styles.label}>{item.label}</span>
                      {item.badge && (
                        <span className={styles.badge}>{item.badge}</span>
                      )}
                    </>
                  )}
                  {isCollapsed && item.badge && (
                    <span className={styles.badgeCollapsed}>{item.badge}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className={styles.footer}>
        {/* User Profile */}
        <button
          className={`${styles.userSection} ${location.pathname === '/profile' ? styles.active : ''}`}
          onClick={handleProfile}
          title={isCollapsed ? 'Профиль' : undefined}
        >
          <div className={styles.avatar}>
            {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.displayName || 'User'}</span>
              <span className={styles.userRole}>{user?.role || 'Role'}</span>
            </div>
          )}
        </button>

        {/* Logout */}
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
          title={isCollapsed ? 'Выйти' : undefined}
        >
          <IoLogOut />
          {!isCollapsed && <span>Выйти</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;