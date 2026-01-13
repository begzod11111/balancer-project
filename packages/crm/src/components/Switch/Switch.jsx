// FILE: packages/crm/src/components/Switch/Switch.jsx
import React, {useId, useState, forwardRef, useImperativeHandle} from 'react';
import cls from './Switch.module.css';

const Switch = forwardRef(({
  id,
  name,
  label,
  labelPosition = 'right', // 'left' | 'right'
  checked,                 // если передан — управляемый режим
  defaultChecked = false,  // иначе — неуправляемый
  onChange,
  disabled = false,
  size = 'md',             // 'sm' | 'md' | 'lg'
  className = ''
}, ref) => {
  const autoId = useId();
  const inputId = id || `switch-${autoId}`;

  const isControlled = typeof checked === 'boolean';
  const [internal, setInternal] = useState(defaultChecked);
  const isOn = isControlled ? checked : internal;

  const setChecked = (next) => {
    if (!isControlled) setInternal(next);
    onChange && onChange(next);
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      const el = document.getElementById(inputId);
      el && el.focus();
    }
  }));

  return (
    <label
      htmlFor={inputId}
      className={[
        cls.wrapper,
        cls[size],
        disabled ? cls.disabled : '',
        className
      ].join(' ')}
    >
      {label && labelPosition === 'left' && (
        <span className={cls.text}>{label}</span>
      )}

      <input
        id={inputId}
        name={name}
        type="checkbox"
        role="switch"
        className={cls.input}
        checked={isOn}
        disabled={disabled}
        onChange={(e) => setChecked(e.target.checked)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setChecked(!isOn);
          }
        }}
      />

      <span className={[cls.track, isOn ? cls.on : cls.off].join(' ')}>
        <span className={cls.thumb} />
      </span>

      {label && labelPosition === 'right' && (
        <span className={cls.text}>{label}</span>
      )}
    </label>
  );
});

export default Switch;