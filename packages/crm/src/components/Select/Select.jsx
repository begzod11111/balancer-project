import React, { useState, useRef, useEffect } from 'react';
import styles from './Select.module.css';

const Select = ({
  options = [],
  value,
  onChange,
  placeholder = 'Выберите...',
  label,
  size = 'medium',
  variant = 'default',
  disabled = false,
  error,
    width = '100%',
    height,
  clearable = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange?.(option.value);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.(null);
  };

  const containerClasses = [
    styles.container,
    styles[variant],
    styles[size],
    isOpen && styles.focused,
    disabled && styles.disabled,
    error && styles.error
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.wrapper} ref={selectRef} style={{
        width,
        height: height || 'auto'
    }}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={containerClasses} onClick={() => !disabled && setIsOpen(!isOpen)}>
        <span className={selectedOption ? styles.value : styles.placeholder}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className={styles.actions}>
          {clearable && selectedOption && !disabled && (
            <button type="button" className={styles.clearBtn} onClick={handleClear}>
              ✕
            </button>
          )}
          <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>▼</span>
        </div>
      </div>
      {isOpen && (
        <div className={styles.dropdown}>
          {options.map((option) => (
            <div
              key={option.value}
              className={`${styles.option} ${value === option.value ? styles.selected : ''}`}
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};

export default Select;
