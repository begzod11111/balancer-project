// packages/crm/src/components/EditTypeModal/EditTypeModal.jsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaPalette } from 'react-icons/fa';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Select from '../Select/Select';
import classes from './EditTypeModal.module.css';

const EditTypeModal = ({ type, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'task',
    icon: '📋',
    color: '#4CAF50',
    defaultWeight: 1.0,
    active: true
  });

  useEffect(() => {
    if (type) {
      setFormData({
        name: type.name || '',
        description: type.description || '',
        category: type.category || 'task',
        icon: type.icon || '📋',
        color: type.color || '#4CAF50',
        defaultWeight: type.defaultWeight || 1.0,
        active: type.active !== undefined ? type.active : true
      });
    }
  }, [type]);

  const categoryOptions = [
    { value: 'task', label: 'Задача' },
    { value: 'bug', label: 'Баг' },
    { value: 'story', label: 'История' },
    { value: 'epic', label: 'Эпик' },
    { value: 'subtask', label: 'Подзадача' }
  ];

  const iconOptions = [
    { value: '📋', label: '📋 Задача' },
    { value: '🐛', label: '🐛 Баг' },
    { value: '📖', label: '📖 История' },
    { value: '🎯', label: '🎯 Эпик' },
    { value: '📌', label: '📌 Подзадача' }
  ];

  const colorOptions = [
    { value: '#4CAF50', label: 'Зелёный' },
    { value: '#f44336', label: 'Красный' },
    { value: '#2196F3', label: 'Синий' },
    { value: '#9C27B0', label: 'Фиолетовый' },
    { value: '#FF9800', label: 'Оранжевый' },
    { value: '#607D8B', label: 'Серый' }
  ];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(type._id, formData);
  };

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <h2>Редактировать тип</h2>
          <button className={classes.closeButton} onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={classes.form}>
          <div className={classes.formGroup}>
            <label>Название *</label>
            <Input
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Введите название типа"
              required
            />
          </div>

          <div className={classes.formGroup}>
            <label>Описание</label>
            <Input
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Описание типа"
            />
          </div>

          <div className={classes.formRow}>
            <div className={classes.formGroup}>
              <label>Категория *</label>
              <Select
                value={formData.category}
                onChange={(value) => handleChange('category', value)}
                options={categoryOptions}
              />
            </div>

            <div className={classes.formGroup}>
              <label>Иконка</label>
              <Select
                value={formData.icon}
                onChange={(value) => handleChange('icon', value)}
                options={iconOptions}
              />
            </div>
          </div>

          <div className={classes.formRow}>
            <div className={classes.formGroup}>
              <label>Цвет</label>
              <div className={classes.colorPicker}>
                <Select
                  value={formData.color}
                  onChange={(value) => handleChange('color', value)}
                  options={colorOptions}
                />
                <div
                  className={classes.colorPreview}
                  style={{ backgroundColor: formData.color }}
                />
              </div>
            </div>

            <div className={classes.formGroup}>
              <label>Вес по умолчанию</label>
              <Input
                type="number"
                value={formData.defaultWeight}
                onChange={(e) => handleChange('defaultWeight', parseFloat(e.target.value))}
                min="0.1"
                max="10"
                step="0.1"
              />
            </div>
          </div>

          <div className={classes.formGroup}>
            <label className={classes.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => handleChange('active', e.target.checked)}
              />
              Активный
            </label>
          </div>

          <div className={classes.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" icon={<FaSave />}>
              Сохранить
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTypeModal;
