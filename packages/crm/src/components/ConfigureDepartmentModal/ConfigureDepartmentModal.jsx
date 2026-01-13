// packages/crm/src/components/ConfigureDepartmentModal/ConfigureDepartmentModal.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaTimes, FaPlus, FaTrash, FaWeight, FaCog, FaCalculator } from 'react-icons/fa';
import Button from '../Button/Button';
import Select from '../Select/Select';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './ConfigureDepartmentModal.module.css';

const ConfigureDepartmentModal = ({ isOpen, onClose, onSuccess, department }) => {
  const { notify } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  const [types, setTypes] = useState([]);
  const [formData, setFormData] = useState({
    taskTypeWeights: {},
    loadCalculationFormula: 'sum(taskWeights) / maxLoad',
    defaultMaxLoad: 100,
    priorityMultiplier: 1.0
  });

  const [selectedType, setSelectedType] = useState(null);
  const [newWeight, setNewWeight] = useState(1.0);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (department) {
      setFormData({
        taskTypeWeights: department.taskTypeWeights || {},
        loadCalculationFormula: department.loadCalculationFormula || 'sum(taskWeights) / maxLoad',
        defaultMaxLoad: department.defaultMaxLoad || 100,
        priorityMultiplier: department.priorityMultiplier || 1.0
      });
    }
  }, [department]);

  useEffect(() => {
    if (isOpen) {
      fetchTypes();
    }
  }, [isOpen]);

  const fetchTypes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_ACTIVE_TYPES, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTypes(response.data.data);
    } catch (error) {
      console.error('Ошибка загрузки типов:', error);
      notify.error('Не удалось загрузить типы задач');
    }
  };

    const handleAddTypeWeight = () => {
        if (!selectedType) {
            notify.warning('Выберите тип задачи');
            return;
        }

        const selectedTypeData = types.find(t => t._id === selectedType);

        if (!selectedTypeData) {
            notify.error('Тип не найден');
            return;
        }

        // Проверяем по typeId (а не по _id)
        if (formData.taskTypeWeights[selectedTypeData.typeId]) {
            notify.warning('Этот тип уже добавлен');
            return;
        }

        if (newWeight < 0.1 || newWeight > 10) {
            notify.error('Вес должен быть от 0.1 до 10');
            return;
        }

        setFormData(prev => ({
            ...prev,
            taskTypeWeights: {
                ...prev.taskTypeWeights,
                [selectedTypeData.typeId]: {
                    weight: parseFloat(newWeight),
                    typeName: selectedTypeData.name,
                    typeId: selectedTypeData.typeId
                }
            }
        }));

        setSelectedType(null);
        setNewWeight(1.0);
        notify.success('Тип задачи добавлен');
    };


  const handleRemoveTypeWeight = (typeId) => {
    setFormData(prev => {
      const { [typeId]: removed, ...rest } = prev.taskTypeWeights;
      return { ...prev, taskTypeWeights: rest };
    });
    notify.success('Тип задачи удалён');
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.defaultMaxLoad <= 0) {
      newErrors.defaultMaxLoad = 'Макс. нагрузка должна быть больше 0';
    }

    if (formData.priorityMultiplier < 0.1 || formData.priorityMultiplier > 5) {
      newErrors.priorityMultiplier = 'Множитель должен быть от 0.1 до 5';
    }

    if (!formData.loadCalculationFormula.trim()) {
      newErrors.loadCalculationFormula = 'Формула обязательна';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      notify.error('Проверьте заполнение полей');
      return;
    }

    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.put(
        URLS.UPDATE_DEPARTMENT(department._id),
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      notify.success('Конфигурация успешно обновлена');
      onSuccess(response.data.data);
      handleClose();
    } catch (error) {
      console.error('Ошибка обновления:', error);
      notify.error(error.response?.data?.message || 'Не удалось обновить конфигурацию');
    } finally {
      hideLoader();
    }
  };

  const handleClose = () => {
    setFormData({
      taskTypeWeights: {},
      loadCalculationFormula: 'sum(taskWeights) / maxLoad',
      defaultMaxLoad: 100,
      priorityMultiplier: 1.0
    });
    setErrors({});
    setSelectedType(null);
    setNewWeight(1.0);
    onClose();
  };

    if (!isOpen || !department) return null;
    const typeOptions = types
        .filter(t => !formData.taskTypeWeights[t.typeId])
        .map(type => ({
            value: type._id,
            label: `${type.name} (${type.category})`
        }));


  return (
    <div className={classes.overlay} onClick={handleClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <div className={classes.headerContent}>
            <FaCog className={classes.headerIcon} />
            <div>
              <h2>Настройка департамента</h2>
              <p className={classes.departmentName}>{department.name}</p>
            </div>
          </div>
          <button className={classes.closeBtn} onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <form className={classes.form} onSubmit={handleSubmit}>
          {/* Веса топов задач */}
          <div className={classes.section}>
            <div className={classes.sectionTitle}>
              <FaWeight /> Веса типов задач
            </div>

            <div className={classes.addTypeWeight}>
              <Select
                options={typeOptions}
                value={selectedType}
                onChange={setSelectedType}
                placeholder="Выберите тип задачи"
              />
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="Вес"
                className={classes.weightInput}
              />
              <Button
                type="button"
                variant="secondary"
                icon={<FaPlus />}
                onClick={handleAddTypeWeight}
              >
                Добавить
              </Button>
            </div>

              <div className={classes.typeWeightsList}>
                  {Object.keys(formData.taskTypeWeights).length === 0 ? (
                      <div className={classes.emptyTypes}>
                          <p>Типы задач не добавлены</p>
                          <small>Добавьте типы задач для расчёта нагрузки</small>
                      </div>
                  ) : (
                      Object.entries(formData.taskTypeWeights).map(([typeId, data]) => (
                          <div key={typeId} className={classes.typeWeightCard}>
                              <div className={classes.typeInfo}>
                                  <span className={classes.typeName}>{data.name}</span>
                                  <span className={classes.typeCategory}>{data.typeId}</span>
                              </div>
                              <div className={classes.typeWeight}>
                                  <FaWeight/>
                                  {data.weight.toFixed(1)}
                              </div>
                              <Button
                                  type="button"
                                  variant="ghost"
                                  icon={<FaTrash/>}
                                  onClick={() => handleRemoveTypeWeight(typeId)}
                              />
                          </div>
                      ))
                  )}
              </div>

          </div>

          {/* Параметры нагрузки */}
          <div className={classes.section}>
            <div className={classes.sectionTitle}>
              <FaCalculator /> Параметры расчёта нагрузки
            </div>

            <div className={classes.formRow}>
              <div className={classes.formGroup}>
                <label>
                  Максимальная нагрузка
                  <span className={classes.required}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.defaultMaxLoad}
                  onChange={(e) => handleChange('defaultMaxLoad', parseInt(e.target.value, 10) || 0)}
                  className={errors.defaultMaxLoad ? classes.errorInput : ''}
                />
                {errors.defaultMaxLoad && (
                  <span className={classes.error}>{errors.defaultMaxLoad}</span>
                )}
              </div>

              <div className={classes.formGroup}>
                <label>
                  Множитель приоритета
                  <span className={classes.required}>*</span>
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={formData.priorityMultiplier}
                  onChange={(e) => handleChange('priorityMultiplier', parseFloat(e.target.value) || 0)}
                  className={errors.priorityMultiplier ? classes.errorInput : ''}
                />
                {errors.priorityMultiplier && (
                  <span className={classes.error}>{errors.priorityMultiplier}</span>
                )}
              </div>
            </div>

            <div className={classes.formGroup}>
              <label>
                Формула расчёта нагрузки
                <span className={classes.required}>*</span>
              </label>
              <textarea
                value={formData.loadCalculationFormula}
                onChange={(e) => handleChange('loadCalculationFormula', e.target.value)}
                placeholder="Введите формулу (например: sum(taskWeights) / maxLoad)"
                className={errors.loadCalculationFormula ? classes.errorInput : ''}
                rows={3}
              />
              {errors.loadCalculationFormula && (
                <span className={classes.error}>{errors.loadCalculationFormula}</span>
              )}
              <small className={classes.hint}>
                например: sum(taskWeights) / maxLoad * priorityMultiplier
              </small>
            </div>
          </div>

          <div className={classes.actions}>
            <Button type="submit">
              Сохранить изменения
            </Button>
            <Button type="button" variant="secondary" onClick={handleClose}>
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigureDepartmentModal;
