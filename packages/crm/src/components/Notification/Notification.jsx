// components/Notification/Notification.jsx
import React, { useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationProvider';
import {
  IoCheckmarkCircle,
  IoCloseCircle,
  IoWarning,
  IoInformationCircle,
  IoClose
} from 'react-icons/io5';
import styles from './Notification.module.css';

const Notification = () => {
  const { notification, hideNotification } = useNotification();

  useEffect(() => {
    if (notification.has) {
      const timer = setTimeout(() => {
        hideNotification();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.has, hideNotification]);

  if (!notification.has) return null;

  const icons = {
    success: <IoCheckmarkCircle />,
    error: <IoCloseCircle />,
    warning: <IoWarning />,
    info: <IoInformationCircle />
  };

  return (
    <div className={`${styles.notification} ${styles[notification.type]}`}>
      <span className={styles.icon}>{icons[notification.type] || icons.info}</span>
      <span className={styles.message}>{notification.message}</span>
      <button className={styles.close} onClick={hideNotification}>
        <IoClose />
      </button>
    </div>
  );
};

export default Notification;
