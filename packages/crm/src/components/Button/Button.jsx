import React from 'react';
import classes from './Button.module.css';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  icon = null,
  iconPosition = 'left',
  fullWidth = false,
  className = ''
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${classes.button} ${classes[variant]} ${fullWidth ? classes.fullWidth : ''} ${className}`}
    >
      {icon && iconPosition === 'left' && (
        <span className={classes.icon}>{icon}</span>
      )}
      {children && <span className={classes.label}>{children}</span>}
      {icon && iconPosition === 'right' && (
        <span className={classes.icon}>{icon}</span>
      )}
    </button>
  );
};

export default Button;
