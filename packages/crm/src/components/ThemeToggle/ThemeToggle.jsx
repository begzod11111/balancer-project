// components/ThemeToggle/ThemeToggle.jsx
import React from 'react';
import { useTheme } from '../../contexts/ThemeProvider';
import styles from './ThemeToggle.module.css';
import {PiMoonStarsDuotone} from "react-icons/pi";
import {LuSunMedium} from "react-icons/lu";

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
    >
      <span className={styles.icon}>
        {isDark ? <LuSunMedium /> : <PiMoonStarsDuotone />}
      </span>
    </button>
  );
};

export default ThemeToggle;

