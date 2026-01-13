import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Checkbox from '../../components/Checkbox/Checkbox';
import { NotificationContext } from '../../contexts/NotificationProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { URLS } from '../../utilities/urls.js';
import { useLoader } from '../../contexts/LoaderProvider';

const LoginPage = () => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useContext(NotificationContext);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email) {
      notify.error('Введите email');
      return;
    }
    if (!password) {
      notify.error('Введите пароль');
      return;
    }
    if (!email.includes('@')) {
      notify.warning('Некорректный email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${URLS.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Ошибка авторизации');
      }

      // Используем AuthProvider для сохранения данных
      login(data, remember);

      notify.success(`Добро пожаловать, ${data.user.displayName}!`);
      navigate('/profile');

    } catch (error) {
      console.error('Login error:', error);
      notify.error(error.message || 'Ошибка входа. Проверьте логин и пароль');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    notify.info('Ссылка для восстановления отправлена на email');
  };

  React.useEffect(() => {
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRemember(true);
    }
  }, []);

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.logoWrapper}>
          <img src="/favicon.svg" alt="Logo" className={styles.logo} />
        </div>

        <h1 className={styles.title}>Добро пожаловать</h1>
        <p className={styles.subtitle}>Войдите в свой аккаунт</p>

        <form className={styles.form} onSubmit={handleLogin}>
          <Input
            label="Email"
            type="email"
            placeholder="example@mail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />

          <Input
            label="Пароль"
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />

          <div className={styles.options}>
            <Checkbox
              label="Запомнить меня"
              checked={remember}
              onChange={(checked) => setRemember(checked)}
              disabled={isLoading}
            />

            <button
              type="button"
              className={styles.forgotLink}
              onClick={handleForgotPassword}
              disabled={isLoading}
            >
              Забыли пароль?
            </button>
          </div>

          <Button
            type="submit"
            className={styles.loginButton}
            disabled={isLoading}
          >
            {isLoading ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
