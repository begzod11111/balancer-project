import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaTimes, FaSave, FaPlus, FaTrash } from 'react-icons/fa';
import Button from '../Button/Button';
import Select from '../Select/Select';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './CreateScheduleModal.module.css';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const CreateScheduleModal = ({ isOpen, onClose, onSuccess }) => {
  const { notify } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  const [formData, setFormData] = useState({
    email: '',
    departmentId: '',
    isActive: true,
    shifts: {},
    limits: {
      maxDailyIssues: 30,
      maxActiveIssues: 30,
      preferredLoadPercent: 80
    }
  });

  const [departments, setDepartments] = useState([]);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_DEPARTMENTS, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const deptOptions = response.data.data
        .filter(dept => dept.active && !dept.delete)
        .map(dept => ({
          value: dept._id,
          label: dept.name
        }));

      setDepartments(deptOptions);
    } catch (error) {
      console.error('Ошибка загрузки отделов:', error);
      notify.error('Не удалось загрузить отделы');
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateTime = (time) => {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(time);
  };

  const validateShift = (shift) => {
    if (!shift.startTime || !shift.endTime) {
      return 'Укажите время начала и окончания';
    }

    if (!validateTime(shift.startTime) || !validateTime(shift.endTime)) {
      return 'Некорректный формат времени (ожидается HH:MM)';
    }

    const [startH, startM] = shift.startTime.split(':').map(Number);
    const [endH, endM] = shift.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes >= endMinutes) {
      return 'Время начала должно быть меньше времени окончания';
    }

    const duration = endMinutes - startMinutes;
    if (duration < 60) {
      return 'Минимальная длительность смены 1 час';
    }

    if (duration > 720) {
      return 'Максимальная длительность смены 12 часов';
    }

    return null;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }

    if (!formData.departmentId) {
      newErrors.departmentId = 'Выберите отдел';
    }

    if (Object.keys(formData.shifts).length === 0) {
      newErrors.shifts = 'Добавьте хотя бы одну смену';
    } else {
      Object.entries(formData.shifts).forEach(([day, shift]) => {
        const shiftError = validateShift(shift);
        if (shiftError) {
          newErrors[`shift_${day}`] = shiftError;
        }
      });
    }

    if (formData.limits.maxDailyIssues < 1 || formData.limits.maxDailyIssues > 100) {
      newErrors.maxDailyIssues = 'Значение должно быть от 1 до 100';
    }

    if (formData.limits.maxActiveIssues < 1 || formData.limits.maxActiveIssues > 100) {
      newErrors.maxActiveIssues = 'Значение должно быть от 1 до 100';
    }

    if (formData.limits.preferredLoadPercent < 1 || formData.limits.preferredLoadPercent > 100) {
      newErrors.preferredLoadPercent = 'Значение должно быть от 1 до 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      notify.error('Исправьте ошибки в форме');
      return;
    }

    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        URLS.GET_WORK_SCHEDULES,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      notify.success('Расписание успешно создано');
      onSuccess?.(response.data.data);
      handleClose();
    } catch (error) {
      console.error('Ошибка создания расписания:', error);
      const errorMessage = error.response?.data?.message || 'Не удалось создать расписание';
      notify.error(errorMessage);
    } finally {
      hideLoader();
    }
  };

  const handleClose = () => {
    setFormData({
      email: '',
      departmentId: '',
      isActive: true,
      shifts: {},
      limits: {
        maxDailyIssues: 30,
        maxActiveIssues: 30,
        preferredLoadPercent: 80
      }
    });
    setErrors({});
    onClose();
  };

  const handleAddShift = () => {
    const emptyDay = [0, 1, 2, 3, 4, 5, 6].find(i => !formData.shifts[i]);

    if (emptyDay === undefined) {
      notify.warning('Все дни недели уже заполнены');
      return;
    }

    setFormData(prev => ({
      ...prev,
      shifts: {
        ...prev.shifts,
        [emptyDay]: { startTime: '09:00', endTime: '18:00' }
      }
    }));
  };

  const handleDeleteShift = (day) => {
    setFormData(prev => {
      const { [day]: removed, ...shifts } = prev.shifts;
      return { ...prev, shifts };
    });
    setErrors(prev => {
      const { [`shift_${day}`]: removed, ...rest } = prev;
      return rest;
    });
  };

  const handleShiftChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      shifts: {
        ...prev.shifts,
        [day]: {
          ...prev.shifts[day],
          [field]: value
        }
      }
    }));
    setErrors(prev => {
      const { [`shift_${day}`]: removed, ...rest } = prev;
      return rest;
    });
  };

  const handleLimitChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      limits: {
        ...prev.limits,
        [field]: parseInt(value, 10) || 0
      }
    }));
    setErrors(prev => {
      const { [field]: removed, ...rest } = prev;
      return rest;
    });
  };

  if (!isOpen) return null;

  return (
    <div className={classes.overlay} onClick={handleClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <h2>Создание расписания</h2>
          <button className={classes.closeBtn} onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={classes.form}>
          <div className={classes.section}>
            <h3>Основная информация</h3>

            <div className={classes.field}>
              <label>Email сотрудника *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                  setErrors(prev => ({ ...prev, email: undefined }));
                }}
                placeholder="user@example.com"
                className={errors.email ? classes.inputError : ''}
              />
              {errors.email && <span className={classes.error}>{errors.email}</span>}
            </div>

            <div className={classes.field}>
              <label>Отдел *</label>
              <Select
                value={formData.departmentId}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, departmentId: value }));
                  setErrors(prev => ({ ...prev, departmentId: undefined }));
                }}
                options={departments}
                placeholder="Выберите отдел"
                className={errors.departmentId ? classes.selectError : ''}
              />
              {errors.departmentId && <span className={classes.error}>{errors.departmentId}</span>}
            </div>

            <div className={classes.field}>
              <label className={classes.checkbox}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <span>Активное расписание</span>
              </label>
            </div>
          </div>

          <div className={classes.section}>
            <div className={classes.sectionHeader}>
              <h3>Смены</h3>
              <Button
                type="button"
                onClick={handleAddShift}
                icon={<FaPlus />}
                size="small"
                disabled={Object.keys(formData.shifts).length >= 7}
              >
                Добавить смену
              </Button>
            </div>
            {errors.shifts && <span className={classes.error}>{errors.shifts}</span>}

            <div className={classes.shifts}>
              {Object.entries(formData.shifts)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([day, shift]) => (
                  <div key={day} className={classes.shiftRow}>
                    <div className={classes.dayLabel}>{DAYS[day]}</div>
                    <input
                      type="time"
                      value={shift.startTime}
                      onChange={(e) => handleShiftChange(day, 'startTime', e.target.value)}
                      className={errors[`shift_${day}`] ? classes.inputError : ''}
                    />
                    <span>—</span>
                    <input
                      type="time"
                      value={shift.endTime}
                      onChange={(e) => handleShiftChange(day, 'endTime', e.target.value)}
                      className={errors[`shift_${day}`] ? classes.inputError : ''}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteShift(day)}
                      className={classes.deleteBtn}
                      title="Удалить смену"
                    >
                      <FaTrash />
                    </button>
                    {errors[`shift_${day}`] && (
                      <span className={classes.shiftError}>{errors[`shift_${day}`]}</span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className={classes.section}>
            <h3>Лимиты</h3>

            <div className={classes.limitsGrid}>
              <div className={classes.field}>
                <label>Макс. задач в день</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.limits.maxDailyIssues}
                  onChange={(e) => handleLimitChange('maxDailyIssues', e.target.value)}
                  className={errors.maxDailyIssues ? classes.inputError : ''}
                />
                {errors.maxDailyIssues && <span className={classes.error}>{errors.maxDailyIssues}</span>}
              </div>

              <div className={classes.field}>
                <label>Макс. активных задач</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.limits.maxActiveIssues}
                  onChange={(e) => handleLimitChange('maxActiveIssues', e.target.value)}
                  className={errors.maxActiveIssues ? classes.inputError : ''}
                />
                {errors.maxActiveIssues && <span className={classes.error}>{errors.maxActiveIssues}</span>}
              </div>

              <div className={classes.field}>
                <label>Предпочитаемая нагрузка (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.limits.preferredLoadPercent}
                  onChange={(e) => handleLimitChange('preferredLoadPercent', e.target.value)}
                  className={errors.preferredLoadPercent ? classes.inputError : ''}
                />
                {errors.preferredLoadPercent && <span className={classes.error}>{errors.preferredLoadPercent}</span>}
              </div>
            </div>
          </div>

          <div className={classes.actions}>
            <Button type="button" onClick={handleClose} variant="secondary">
              Отмена
            </Button>
            <Button type="submit" icon={<FaSave />}>
              Создать расписание
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateScheduleModal;
