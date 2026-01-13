import React from 'react';
import styles from './Checkbox.module.css';

const Checkbox = ({
  checked = false,
  onChange,
  label,
  size = 'medium',
  disabled = false,
  error,
  indeterminate = false
}) => {
  const handleChange = (e) => {
    if (!disabled) {
      onChange?.(e.target.checked);
    }
  };

  const containerClasses = [
    styles.container,
    styles[size],
    disabled && styles.disabled,
    error && styles.error
  ].filter(Boolean).join(' ');

  const boxClasses = [
    styles.checkbox,
    checked && styles.checked,
    indeterminate && styles.indeterminate
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.wrapper}>
      <label className={containerClasses}>
        <input
          type="checkbox"
          className={styles.input}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
        />
        <span className={boxClasses}>
          {checked && !indeterminate && (
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {indeterminate && (
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none">
              <path d="M6 12h12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          )}
        </span>
        {label && <span className={styles.label}>{label}</span>}
      </label>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};

export default Checkbox;
