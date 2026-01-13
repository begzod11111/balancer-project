import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaTimes } from 'react-icons/fa';
import Button from '../Button/Button';
import Select from '../Select/Select';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './CreateTypeModal.module.css';

const CreateTypeModal = ({ isOpen, onClose, onSuccess }) => {
  const {notify} = useNotification();
  const loader = useLoader();

  const [formData, setFormData] = useState({
    name: '',
    typeId: '',
    category: 'task',
    description: '',
    icon: '',
    color: '#4CAF50',
    defaultWeight: 1.0,
    active: true
  });

  const [errors, setErrors] = useState({});

  const categoryOptions = [
    { value: 'task', label: 'Задача' },
    { value: 'bug', label: 'Баг' },
    { value: 'story', label: 'История' },
    { value: 'epic', label: 'Эпик' }
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Название обязательно';
    }

    if (!formData.typeId.trim()) {
      newErrors.typeId = 'ID типа обязателен';
    }

    if (formData.defaultWeight < 0.1 || formData.defaultWeight > 10) {
      newErrors.defaultWeight = 'Вес должен быть от 0.1 до 10';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
        notify.error('Заполните все обязательные поля');
      return;
    }

    if (loader?.showLoader) loader.showLoader();

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        URLS.CREATE_TYPE,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

        notify.success('Тип успешно создан');


      if (onSuccess) {
        onSuccess(response.data.data);
      }

      handleClose();
    } catch (error) {
      console.error('Ошибка создания типа:', error);
    notify.error(
      error.response?.data?.message || 'Не удалось создать тип',
    );

    } finally {
      if (loader?.hideLoader) loader.hideLoader();
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      typeId: '',
      category: 'task',
      description: '',
      icon: '',
      color: '#4CAF50',
      defaultWeight: 1.0,
      active: true
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={classes.overlay} onClick={handleClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <h2>Создать новый тип</h2>
          <button className={classes.closeBtn} onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <form className={classes.form} onSubmit={handleSubmit}>
          <div className={classes.formRow}>
            <div className={classes.formGroup}>
              <label>
                Название <span className={classes.required}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Введите название типа"
                className={errors.name ? classes.inputError : ''}
              />
              {errors.name && <span className={classes.error}>{errors.name}</span>}
            </div>

            <div className={classes.formGroup}>
              <label>
                ID типа (Jira) <span className={classes.required}>*</span>
              </label>
              <input
                type="text"
                name="typeId"
                value={formData.typeId}
                onChange={handleChange}
                placeholder="10001"
                className={errors.typeId ? classes.inputError : ''}
              />
              {errors.typeId && <span className={classes.error}>{errors.typeId}</span>}
            </div>
          </div>

          <div className={classes.formRow}>
            <div className={classes.formGroup}>
              <label>Категория</label>
              <Select
                options={categoryOptions}
                value={formData.category}
                onChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              />
            </div>

            <div className={classes.formGroup}>
              <label>Вес по умолчанию</label>
              <input
                type="number"
                name="defaultWeight"
                step="0.1"
                min="0.1"
                max="10"
                value={formData.defaultWeight}
                onChange={handleChange}
                className={errors.defaultWeight ? classes.inputError : ''}
              />
              {errors.defaultWeight && <span className={classes.error}>{errors.defaultWeight}</span>}
            </div>
          </div>

          <div className={classes.formRow}>
            <div className={classes.formGroup}>
              <label>Иконка (emoji)</label>
              <input
                type="text"
                name="icon"
                value={formData.icon}
                onChange={handleChange}
                placeholder="📝"
                maxLength="2"
              />
            </div>

            <div className={classes.formGroup}>
              <label>Цвет</label>
              <input
                type="color"
                name="color"
                value={formData.color}
                onChange={handleChange}
                className={classes.colorInput}
              />
            </div>
          </div>

          <div className={classes.formGroup}>
            <label>Описание</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Описание типа задачи"
              rows="3"
            />
          </div>

          <div className={classes.checkboxGroup}>
            <label>
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleChange}
              />
              <span>Активен по умолчанию</span>
            </label>
          </div>

          <div className={classes.actions}>
            <Button type="button" variant="secondary" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit">
              Создать тип
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTypeModal;
