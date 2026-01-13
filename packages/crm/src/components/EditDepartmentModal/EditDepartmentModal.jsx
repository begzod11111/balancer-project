import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaTimes } from 'react-icons/fa';
import Button from '../Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './EditDepartmentModal.module.css';
import Input from "../Input/Input";

const EditDepartmentModal = ({ isOpen, onClose, onSuccess, department }) => {
  const { notify } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  const [formData, setFormData] = useState({
    name: '',
    ObjectId: '',
    description: '',
    active: true
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || '',
        ObjectId: department.ObjectId || '',
        description: department.description || '',
        active: department.active !== undefined ? department.active : true
      });
    }
  }, [department]);

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

    if (!formData.ObjectId.trim()) {
      newErrors.ObjectId = 'Object ID обязателен';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      notify('Заполните все обязательные поля', 'error');
      return;
    }

    showLoader();
    try {
      const response = await axios.put(
        URLS.UPDATE_DEPARTMENT(department._id),
        formData
      );

      if (response.data.success) {
        notify('Департамент обновлен', 'success');
        onSuccess(response.data.data);
        handleClose();
      }
    } catch (error) {
      console.error('Ошибка обновления департамента:', error);
      notify(
        error.response?.data?.message || 'Ошибка обновления департамента',
        'error'
      );
    } finally {
      hideLoader();
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      ObjectId: '',
      description: '',
      active: true
    });
    setErrors({});
    onClose();
  };

  if (!isOpen || !department) return null;

  return (
    <div className={classes.overlay} onClick={handleClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <h2>Редактировать департамент</h2>
          <button onClick={handleClose} className={classes.closeBtn}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={classes.form}>
          <div className={classes.formGroup}>
            <label>
              Название <span className={classes.required}>*</span>
            </label>
            <Input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? classes.inputError : ''}
              placeholder="Введите название департамента"
            />
            {errors.name && <span className={classes.error}>{errors.name}</span>}
          </div>

          <div className={classes.formGroup}>
            <label>
              Object ID <span className={classes.required}>*</span>
            </label>
            <Input
              type="text"
              name="ObjectId"
              value={formData.ObjectId}
              onChange={handleChange}
              className={errors.ObjectId ? classes.inputError : ''}
              placeholder="Введите уникальный идентификатор"
            />
            {errors.ObjectId && <span className={classes.error}>{errors.ObjectId}</span>}
            <span className={classes.hint}>Используется для интеграции с Jira</span>
          </div>

          <div className={classes.formGroup}>
            <label>Описание</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Опишите назначение департамента"
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
              <span>Департамент активен</span>
            </label>
          </div>

          <div className={classes.actions}>
            <Button type="button" variant="secondary" onClick={handleClose}>
              Отмена
            </Button>
            <Button type="submit" variant="primary">
              Сохранить изменения
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDepartmentModal;
