// packages/crm/src/components/CreateDepartmentModal/CreateDepartmentModal.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaTimes, FaPlus, FaTrash, FaWeight, FaBuilding, FaCheck } from 'react-icons/fa';
import Button from '../Button/Button';
import Select from '../Select/Select';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './CreateDepartmentModal.module.css';
import Input from "../Input/Input";

const CreateDepartmentModal = ({ isOpen, onClose, onSuccess }) => {
  const { notify } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  const [types, setTypes] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    ObjectId: '',
    description: '',
    active: true,
    taskTypeWeights: {},
    loadCalculationFormula: 'sum(taskWeights) / maxLoad',
    defaultMaxLoad: 100,
    priorityMultiplier: 1.0
  });

  const [selectedType, setSelectedType] = useState(null);
  const [newWeight, setNewWeight] = useState(1.0);

  useEffect(() => {
    if (isOpen) {
      loadTypes();
      resetForm();
    }
  }, [isOpen]);

  const loadTypes = async () => {
    try {
      const response = await axios.get(URLS.GET_ACTIVE_TYPES, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (response.data.success) {
        setTypes(response.data.data || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки типов:', error);
      notify.error('Не удалось загрузить типы задач');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      ObjectId: '',
      description: '',
      active: true,
      taskTypeWeights: {},
      loadCalculationFormula: 'sum(taskWeights) / maxLoad',
      defaultMaxLoad: 100,
      priorityMultiplier: 1.0
    });
    setSelectedType(null);
    setNewWeight(1.0);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

    // Проверка по typeId
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
      const newWeights = { ...prev.taskTypeWeights };
      delete newWeights[typeId];
      return { ...prev, taskTypeWeights: newWeights };
    });
    notify.info('Тип задачи удалён');
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name.trim()) {
        notify.warning('Название департам��нта обязательно');
        return;
      }

      if (!formData.ObjectId.trim()) {
        notify.warning('ObjectId обязателен');
        return;
      }

      if (formData.defaultMaxLoad < 1) {
        notify.warning('Максимальная нагрузка должна быть больше 0');
        return;
      }

      if (formData.priorityMultiplier < 0.1 || formData.priorityMultiplier > 5) {
        notify.warning('Множитель приоритета должен быть от 0.1 до 5');
        return;
      }

      showLoader('Создание департамента...');

      const response = await axios.post(URLS.CREATE_DEPARTMENT, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });

      hideLoader();

      if (!response.data.success) {
        throw new Error(response.data.message || 'Ошибка создания департамента');
      }

      notify.success('Департамент успешно создан');

      if (onSuccess) {
        onSuccess(response.data.data);
      }

      onClose();
    } catch (error) {
      hideLoader();
      console.error('Ошибка создания департамента:', error);

      const errorMessage = error.response?.data?.message || error.message || 'Не удалось создать департамент';
      notify.error(errorMessage);
    }
  };

  const typeOptions = types
    .filter(t => !formData.taskTypeWeights[t.typeId])
    .map(type => ({
      value: type._id,
      label: `${type.icon || '📋'} ${type.name} (${type.category})`
    }));

  if (!isOpen) return null;

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <div className={classes.headerTitle}>
            <FaBuilding className={classes.icon} />
            <h2>Создание департамента</h2>
          </div>
          <button className={classes.closeButton} onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className={classes.content}>
          <div className={classes.section}>
            <h3>Основная информация</h3>

            <div className={classes.formGroup}>
              <label>Название департамента *</label>
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Например: Техническая поддержка"
              />
            </div>

            <div className={classes.formGroup}>
              <label>ObjectId *</label>
              <Input
                value={formData.ObjectId}
                onChange={(e) => handleInputChange('ObjectId', e.target.value)}
                placeholder="Уникальный идентификатор"
              />
            </div>

            <div className={classes.formGroup}>
              <label>Описание</label>
              <textarea
                className={classes.textarea}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Описание департамента"
                rows={3}
              />
            </div>

            <div className={classes.formGroup}>
              <label className={classes.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                />
                <FaCheck className={classes.checkIcon} />
                Активен
              </label>
            </div>
          </div>

          <div className={classes.section}>
            <h3>Параметры нагрузки</h3>

            <div className={classes.formGroup}>
              <label>Формула расчёта нагрузки</label>
              <Input
                value={formData.loadCalculationFormula}
                onChange={(e) => handleInputChange('loadCalculationFormula', e.target.value)}
                placeholder="sum(taskWeights) / maxLoad"
              />
              <span className={classes.hint}>
                Доступные переменные: taskWeights, activeIssues, maxLoad, dailyIssues, priorityMultiplier
              </span>
            </div>

            <div className={classes.row}>
              <div className={classes.formGroup}>
                <label>Максимальная нагрузка</label>
                <Input
                  type="number"
                  value={formData.defaultMaxLoad}
                  onChange={(e) => handleInputChange('defaultMaxLoad', parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>

              <div className={classes.formGroup}>
                <label>Множитель приоритета</label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.priorityMultiplier}
                  onChange={(e) => handleInputChange('priorityMultiplier', parseFloat(e.target.value) || 1.0)}
                  min={0.1}
                  max={5}
                />
              </div>
            </div>
          </div>

          <div className={classes.section}>
            <h3>
              <FaWeight className={classes.icon} />
              Веса типов задач
            </h3>

            <div className={classes.weightInput}>
              <Select
                value={selectedType || ''}
                onChange={(e) => setSelectedType(e.target.value)}
                options={[
                  { value: '', label: 'Выберите тип...' },
                  ...typeOptions
                ]}
              />

              <Input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={newWeight}
                onChange={(e) => setNewWeight(parseFloat(e.target.value) || 1.0)}
                placeholder="Вес"
              />

              <Button
                variant="secondary"
                onClick={handleAddTypeWeight}
                disabled={!selectedType}
              >
                <FaPlus /> Добавить
              </Button>
            </div>

            <div className={classes.typeWeightsList}>
              {Object.keys(formData.taskTypeWeights).length === 0 ? (
                <div className={classes.emptyTypes}>
                  <p>Типы задач не добавлены</p>
                  <small>Добавьте типы задач для расчёта нагрузки</small>
                </div>
              ) : (
                Object.entries(formData.taskTypeWeights).map(([typeId, data]) => {
                  const type = types.find(t => t.typeId === typeId);
                  return (
                    <div key={typeId} className={classes.typeWeightCard}>
                      <div className={classes.typeInfo}>
                        <span className={classes.typeIcon}>{type?.icon || '📋'}</span>
                        <span className={classes.typeName}>{data.typeName}</span>
                        <span className={classes.typeCategory}>{type?.category || 'task'}</span>
                      </div>
                      <div className={classes.typeWeight}>
                        <FaWeight />
                        {data.weight.toFixed(1)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        icon={<FaTrash />}
                        onClick={() => handleRemoveTypeWeight(typeId)}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className={classes.footer}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            <FaPlus /> Создать департамент
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateDepartmentModal;
