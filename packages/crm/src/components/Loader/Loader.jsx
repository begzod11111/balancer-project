// Loader.jsx
import React from 'react';
import styles from './Loader.module.css';

const Loader = ({ text = 'Загрузка...' }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.loaderContainer}>
        <div className={styles.spinner}>
          <div className={styles.ring}></div>
          <div className={styles.ring}></div>
          <div className={styles.ring}></div>
        </div>
        {text && <p className={styles.text}>{text}</p>}
      </div>
    </div>
  );
};

export default Loader;
