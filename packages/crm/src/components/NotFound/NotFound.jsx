// NotFound.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NotFound.module.css';
import Button from '../../components/Button/Button';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.notFoundPage}>
      <div className={styles.card}>
        <div className={styles.logoWrapper}>
          <img src="/favicon.svg" alt="Logo" className={styles.logo} />
        </div>

        <div className={styles.errorCode}>404</div>

        <h1 className={styles.title}>Страница не найдена</h1>
        <p className={styles.subtitle}>
          Запрашиваемая страница не существует или была перемещена
        </p>

        <div className={styles.actions}>
          <Button
            className={styles.homeButton}
            onClick={() => navigate('/')}
          >
            На главную
          </Button>
          <button
            className={styles.backLink}
            onClick={() => navigate(-1)}
          >
            Вернуться назад
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
