// pages/ProfilePage/ProfilePage.jsx
import React, {useState, useEffect, useCallback} from 'react';
import { useAuth } from '../../contexts/AuthProvider';
import { useNotification } from '../../contexts/NotificationProvider';
import { useTheme } from '../../contexts/ThemeProvider';
import { URLS } from '../../utilities/urls.js';
import {
  IoPersonCircle,
  IoMail,
  IoShield,
  IoBusiness,
  IoKey,
  IoNotifications,
  IoColorPalette,
  IoLanguage,
  IoCheckmarkCircle,
  IoCloseCircle
} from 'react-icons/io5';
import styles from './ProfilePage.module.css';
import {useLoader} from "../../contexts/LoaderProvider";

const ProfilePage = (callback, deps) => {
    const {showLoader, hideLoader} = useLoader();
    const {getToken} = useAuth();
    const {notify} = useNotification();
    const {setTheme} = useTheme();
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        memoizedCallback();
    }, []);

    const memoizedCallback = useCallback(
        async () => {
            showLoader('Загрузка профиля...');
            console.log(profile)
            try {
                const token = getToken();
                const response = await fetch(`${URLS.ME}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Ошибка загрузки профиля');
                }

                const data = await response.json();
                setProfile(data);

                if (data.settings?.theme) {
                    setTheme(data.settings.theme);
                }
            } catch (error) {
                notify.error(error.message);
            } finally {
                hideLoader();
            }
        },
        [] // Array of dependencies
    );


    const getRoleName = (role) => {
        const roles = {
            owner: 'Владелец',
            admin: 'Администратор',
            manager: 'Менеджер',
            user: 'Пользователь'
        };
        return roles[role] || role;
    };

    const getRoleColor = (role) => {
        const colors = {
            owner: '#8b5cf6',
            admin: '#ef4444',
            manager: '#f59e0b',
            user: '#3b82f6'
        };
        return colors[role] || '#6b7280';
    };

    if (!profile) {
        return null;
    }

    return (
        <div className={styles.profilePage}>
            <div className={styles.header}>
                <h1 className={styles.title}>Профиль</h1>
            </div>

            <div className={styles.content}>
                {/* Карточка пользователя */}
                <div className={styles.userCard}>
                    <div className={styles.avatar}>
                        <IoPersonCircle/>
                    </div>
                    <div className={styles.userInfo}>
                        <h2 className={styles.displayName}>{profile.displayName}</h2>
                        <span
                            className={styles.roleBadge}
                            style={{backgroundColor: getRoleColor(profile.role)}}
                        >
              {getRoleName(profile.role)}
            </span>
                    </div>
                </div>

                {/* Основная информация */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Основная информация</h3>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <div className={styles.infoIcon}>
                                <IoMail/>
                            </div>
                            <div className={styles.infoContent}>
                                <span className={styles.infoLabel}>Email</span>
                                <span className={styles.infoValue}>{profile.email}</span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <div className={styles.infoIcon}>
                                <IoPersonCircle/>
                            </div>
                            <div className={styles.infoContent}>
                                <span className={styles.infoLabel}>Имя пользователя</span>
                                <span className={styles.infoValue}>{profile.username}</span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <div className={styles.infoIcon}>
                                <IoBusiness/>
                            </div>
                            <div className={styles.infoContent}>
                                <span className={styles.infoLabel}>Отдел</span>
                                <span className={styles.infoValue}>{profile.department}</span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <div className={styles.infoIcon}>
                                <IoShield/>
                            </div>
                            <div className={styles.infoContent}>
                                <span className={styles.infoLabel}>Роль</span>
                                <span className={styles.infoValue}>{getRoleName(profile.role)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Права доступа */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <IoKey/> Права доступа
                    </h3>
                    <div className={styles.permissionsList}>
                        {profile.permissions.map((permission, index) => (
                            <span key={index} className={styles.permissionBadge}>
                {permission === '*' ? 'Полный доступ' : permission}
              </span>
                        ))}
                    </div>
                </div>

                {/* Настройки */}
                {profile.settings && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Настройки</h3>
                        <div className={styles.settingsGrid}>
                            {/* Уведомления */}
                            <div className={styles.settingsCard}>
                                <div className={styles.settingsHeader}>
                                    <IoNotifications/>
                                    <span>Уведомления</span>
                                </div>
                                <div className={styles.settingsContent}>
                                    <div className={styles.settingRow}>
                                        <span>Email уведомления</span>
                                        {profile.settings.notifications?.email ? (
                                            <IoCheckmarkCircle className={styles.settingOn}/>
                                        ) : (
                                            <IoCloseCircle className={styles.settingOff}/>
                                        )}
                                    </div>
                                    <div className={styles.settingRow}>
                                        <span>Push уведомления</span>
                                        {profile.settings.notifications?.push ? (
                                            <IoCheckmarkCircle className={styles.settingOn}/>
                                        ) : (
                                            <IoCloseCircle className={styles.settingOff}/>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Тема */}
                            <div className={styles.settingsCard}>
                                <div className={styles.settingsHeader}>
                                    <IoColorPalette/>
                                    <span>Тема</span>
                                </div>
                                <div className={styles.settingsContent}>
                                    <div className={styles.settingRow}>
                                        <span>Текущая тема</span>
                                        <span className={styles.settingValue}>
                      {profile.settings.theme === 'dark' ? 'Тёмная' : 'Светлая'}
                    </span>
                                    </div>
                                </div>
                            </div>

                            {/* Язык */}
                            <div className={styles.settingsCard}>
                                <div className={styles.settingsHeader}>
                                    <IoLanguage/>
                                    <span>Язык</span>
                                </div>
                                <div className={styles.settingsContent}>
                                    <div className={styles.settingRow}>
                                        <span>Текущий язык</span>
                                        <span className={styles.settingValue}>
                      {profile.settings.language === 'ru' ? 'Русский' : profile.settings.language}
                    </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


export default ProfilePage;