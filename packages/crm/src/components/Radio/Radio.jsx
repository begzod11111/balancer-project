import React from 'react';
import cls from './Radio.module.css';

const Radio = ({
  name,
  options = [],                 // [{ value, label, disabled? }]
  selectedValue,
  onChange,
  direction = 'row',            // 'row' | 'column'
  size = 'md',                  // 'sm' | 'md' | 'lg'
  disabled = false,
  className = ''
}) => {
  return (
    <div className={[cls.group, cls[direction], className].join(' ')}>
      {options.map(opt => {
        const isChecked = selectedValue === opt.value;
        const isDisabled = disabled || !!opt.disabled;
        const id = `${name}-${opt.value}`;

        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={[
              cls.item,
              cls[size],
              isDisabled ? cls.disabled : ''
            ].join(' ')}
          >
            <input
              id={id}
              className={cls.input}
              type="radio"
              name={name}
              value={opt.value}
              disabled={isDisabled}
              checked={isChecked}
              onChange={(e) => onChange && onChange(e.target.value)}
            />
            <span className={[cls.control, isChecked ? cls.checked : ''].join(' ')}>
              <span className={cls.dot} />
            </span>
            <span className={cls.label}>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
};

export default Radio;