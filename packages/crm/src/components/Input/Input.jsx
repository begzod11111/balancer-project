import React, { useState, useRef } from 'react';
import styles from './Input.module.css';

const Input = ({
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  size = 'medium',
  variant = 'default',
  disabled = false,
  error,
  clearable = false,
  accept,
    height,
    width = '100%',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleClear = () => {
    onChange?.({ target: { value: '' } });
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : '');
    onChange?.(e);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const containerClasses = [
    styles.container,
    styles[variant],
    styles[size],
    isFocused && styles.focused,
    disabled && styles.disabled,
    error && styles.error,
    type === 'file' && styles.fileContainer
  ].filter(Boolean).join(' ');

  if (type === 'file') {
    return (
      <div className={styles.wrapper}>
        {label && <label className={styles.label}>{label}</label>}
        <div className={containerClasses} onClick={handleFileClick}>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            onChange={handleFileChange}
            disabled={disabled}
            accept={accept}
            {...props}
          />
          <div className={styles.fileContent}>
            <span className={styles.fileIcon}>📁</span>
            <span className={fileName ? styles.fileName : styles.filePlaceholder}>
              {fileName || placeholder || 'Выберите файл...'}
            </span>
          </div>
          <div className={styles.fileActions}>
            {fileName && clearable && (
              <button type="button" className={styles.clearBtn} onClick={(e) => { e.stopPropagation(); handleClear(); }}>
                ✕
              </button>
            )}
            <span className={styles.fileBtn}>Обзор</span>
          </div>
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={{
        width,
        height: height || 'auto'
    }}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={containerClasses}>
        <input
          type={type}
          className={styles.input}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {clearable && value && (
          <button type="button" className={styles.clearBtn} onClick={handleClear}>
            ✕
          </button>
        )}
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};

export default Input;
