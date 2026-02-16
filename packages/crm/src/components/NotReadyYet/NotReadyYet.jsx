import React from 'react';
import styles from './NotReadyYet.module.css';

export default function NotReadyYet() {
    return (

        <div>
            <div>
                <div>🚀</div>
                Страница в разработке
                Мы работаем над этой страницей, чтобы сделать её лучше для вас.

                Пожалуйста, вернитесь позже!

                <button onClick={() => window.history.back()} className={styles.backButton}> ← Вернуться назад </button>
                </div>
        </div>
); }
