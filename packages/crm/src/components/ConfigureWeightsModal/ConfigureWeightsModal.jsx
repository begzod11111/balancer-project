// packages/crm/src/components/ConfigureWeightsModal/ConfigureWeightsModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import {
  FaTimes,
  FaSave,
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaInfoCircle,
  FaWeight,
  FaSearch
} from 'react-icons/fa';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './ConfigureWeightsModal.module.css';

const ConfigureWeightsModal = ({
  department,
  types = [],
  onClose,
  onUpdate
}) => {
  const { notify } = useNotification();
  const loader = useLoader();

  // State
  const [weights, setWeights] = useState({});
  const [expandedTypes, setExpandedTypes] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Инициализация весов из департамента при загрузке
  useEffect(() => {
    if (department && department.taskTypeWeights) {
      const initialWeights = {};

      department.taskTypeWeights.forEach(tw => {
        initialWeights[tw.typeId] = {
          weight: tw.weight || 1.0,
          name: tw.name || '',
          statuses: {}
        };

        // Инициализация весов статусов
        if (tw.statusWeights && Array.isArray(tw.statusWeights)) {
          tw.statusWeights.forEach(sw => {
            initialWeights[tw.typeId].statuses[sw.statusId] = {
              weight: sw.weight || 1.0,
              statusName: sw.statusName || ''
            };
          });
        }
      });

      setWeights(initialWeights);
      setHasChanges(false);
    }
  }, [department]);

  // Фильтрация типов по поиску
  const filteredTypes = useMemo(() => {
    if (!searchQuery.trim()) return types;

    const query = searchQuery.toLowerCase();
    return types.filter(type =>
      type.name.toLowerCase().includes(query) ||
      type.typeId.toLowerCase().includes(query)
    );
  }, [types, searchQuery]);

  // Обработчик изменения веса типа
  const handleTypeWeightChange = (typeId, weight) => {
    const numWeight = parseFloat(weight);

    if (isNaN(numWeight) || numWeight < 0.1 || numWeight > 10) {
      notify.error('Вес должен быть от 0.1 до 10');
      return;
    }

    setWeights(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        weight: numWeight
      }
    }));

    setHasChanges(true);
  };

  // Обработчик изменения веса статуса
  const handleStatusWeightChange = (typeId, statusId, weight) => {
    const numWeight = parseFloat(weight);

    if (isNaN(numWeight) || numWeight < 0.1 || numWeight > 10) {
      notify.error('Вес должен быть от 0.1 до 10');
      return;
    }

    setWeights(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        statuses: {
          ...(prev[typeId]?.statuses || {}),
          [statusId]: {
            ...prev[typeId]?.statuses?.[statusId],
            weight: numWeight
          }
        }
      }
    }));

    setHasChanges(true);
  };

  // Добавление веса типа
  const handleAddTypeWeight = (type) => {
    setWeights(prev => ({
      ...prev,
      [type.typeId]: {
        weight: type.defaultWeight || 1.0,
        name: type.name || '',
        statuses: {}
      }
    }));

    setExpandedTypes(prev => ({ ...prev, [type.typeId]: true }));
    setHasChanges(true);
  };

  // Удаление веса типа
  const handleRemoveTypeWeight = (typeId) => {
    if (!window.confirm('Удалить вес типа? Он вернётся к значению по умолчанию (1.0)')) {
      return;
    }

    setWeights(prev => {
      const newWeights = { ...prev };
      delete newWeights[typeId];
      return newWeights;
    });

    setHasChanges(true);
  };

  // Добавление веса статуса
  const handleAddStatusWeight = (typeId, status) => {
    setWeights(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        statuses: {
          ...(prev[typeId]?.statuses || {}),
          [status.statusId]: {
            weight: status.weight || 1.0,
            statusName: status.name || ''
          }
        }
      }
    }));

    setHasChanges(true);
  };

  // Удаление веса статуса
  const handleRemoveStatusWeight = (typeId, statusId) => {
    if (!window.confirm('Удалить вес статуса? Будет использоваться вес типа')) {
      return;
    }

    setWeights(prev => {
      const newWeights = { ...prev };
      if (newWeights[typeId]?.statuses) {
        delete newWeights[typeId].statuses[statusId];
      }
      return newWeights;
    });

    setHasChanges(true);
  };

  // Переключение раскрытия типа
  const toggleTypeExpanded = (typeId) => {
    setExpandedTypes(prev => ({ ...prev, [typeId]: !prev[typeId] }));
  };

  // Сохранение всех изменений
  const handleSave = async () => {
    try {
      loader.showLoader();
      const token = localStorage.getItem('accessToken');

      // Сохранение весов для каждого типа
      const savePromises = Object.entries(weights).map(([typeId, data]) => {
        const type = types.find(t => t.typeId === typeId);

        // Формируем массив весов статусов
        const statusWeights = Object.entries(data.statuses || {}).map(([statusId, statusData]) => ({
          statusId,
          statusName: statusData.statusName || '',
          weight: statusData.weight || 1.0
        }));

        return axios.put(
          URLS.SET_TYPE_WEIGHT(department._id || department.id, typeId),
          {
            typeId,
            name: type?.name || data.name || '',
            weight: data.weight || 1.0,
            statusWeights
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      });

      await Promise.all(savePromises);

      notify.success('Веса успешно сохранены');
      setHasChanges(false);

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('[handleSave] Ошибка:', error);
      notify.error(error.response?.data?.message || 'Ошибка при сохранении весов');
    } finally {
      loader.hideLoader();
    }
  };

  // Проверка наличия веса у типа
  const hasTypeWeight = (typeId) => weights[typeId] !== undefined;

  // Получение статусов типа из переданных данных types
  const getTypeStatuses = (typeId) => {
    const type = types.find(t => t.typeId === typeId);
    return type?.weightedStatuses || [];
  };

  if (!department) {
    return null;
  }

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={classes.header}>
          <div className={classes.headerLeft}>
            <FaWeight className={classes.headerIcon} />
            <div className={classes.headerInfo}>
              <h2 className={classes.title}>Настройка весов задач</h2>
              <p className={classes.subtitle}>
                Департамент: <strong>{department.name}</strong>
              </p>
            </div>
          </div>

          <button className={classes.closeBtn} onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {/* Info */}
        <div className={classes.info}>
          <FaInfoCircle className={classes.infoIcon} />
          <div>
            <p>
              <strong>Веса задач</strong> определяют приоритет распределения.
              Диапазон: <strong>0.1 - 10.0</strong>
            </p>
            <p>
              Вес статуса переопределяет вес типа для конкретного статуса задачи.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className={classes.search}>
          <div className={classes.searchWrapper}>
            <FaSearch className={classes.searchIcon} />
            <Input
              placeholder="Поиск типов задач..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className={classes.content}>
          {filteredTypes.length === 0 ? (
            <div className={classes.emptyState}>
              <FaWeight className={classes.emptyIcon} />
              <p>
                {searchQuery ? 'Типы не найдены' : 'Нет доступных типов задач'}
              </p>
            </div>
          ) : (
            <div className={classes.typesList}>
              {filteredTypes.map(type => {
                const hasWeight = hasTypeWeight(type.typeId);
                const typeWeight = weights[type.typeId];
                const isExpanded = expandedTypes[type.typeId];
                const typeStatuses = getTypeStatuses(type.typeId);

                return (
                  <div key={type.typeId} className={classes.typeItem}>
                    {/* Type Header */}
                    <div className={classes.typeHeader}>
                      <div className={classes.typeInfo}>
                        <div className={classes.typeName}>{type.name}</div>
                        <div className={classes.typeId}>ID: {type.typeId}</div>
                      </div>

                      {hasWeight ? (
                        <div className={classes.weightControls}>
                          <Input
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={typeWeight.weight}
                            onChange={(e) => handleTypeWeightChange(type.typeId, e.target.value)}
                            className={classes.weightInput}
                          />

                          {typeStatuses.length > 0 && (
                            <Button
                              variant="ghost"
                              size="small"
                              icon={isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                              onClick={() => toggleTypeExpanded(type.typeId)}
                            />
                          )}

                          <Button
                            variant="danger"
                            size="small"
                            icon={<FaTrash />}
                            onClick={() => handleRemoveTypeWeight(type.typeId)}
                          />
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="small"
                          icon={<FaPlus />}
                          onClick={() => handleAddTypeWeight(type)}
                        >
                          Добавить вес
                        </Button>
                      )}
                    </div>

                    {/* Statuses */}
                    {hasWeight && isExpanded && typeStatuses.length > 0 && (
                      <div className={classes.statusesList}>
                        <div className={classes.statusesHeader}>
                          <span>Статусы задач ({typeStatuses.length})</span>
                        </div>

                        {typeStatuses.map(status => {
                          const hasStatusWeight = typeWeight.statuses?.[status.statusId] !== undefined;
                          const statusWeight = typeWeight.statuses?.[status.statusId];

                          return (
                            <div key={status.statusId} className={classes.statusItem}>
                              <div className={classes.statusInfo}>
                                <div className={classes.statusName}>
                                  {status.name}
                                </div>
                                <div className={classes.statusId}>
                                  ID: {status.statusId}
                                </div>
                              </div>

                              {hasStatusWeight ? (
                                <div className={classes.statusControls}>
                                  <Input
                                    type="number"
                                    min="0.1"
                                    max="10"
                                    step="0.1"
                                    value={statusWeight.weight}
                                    onChange={(e) => handleStatusWeightChange(
                                      type.typeId,
                                      status.statusId,
                                      e.target.value
                                    )}
                                    className={classes.weightInput}
                                  />

                                  <Button
                                    variant="danger"
                                    size="small"
                                    icon={<FaTrash />}
                                    onClick={() => handleRemoveStatusWeight(
                                      type.typeId,
                                      status.statusId
                                    )}
                                  />
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="small"
                                  icon={<FaPlus />}
                                  onClick={() => handleAddStatusWeight(type.typeId, status)}
                                >
                                  Добавить
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={classes.footer}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>

          <Button
            variant="primary"
            icon={<FaSave />}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Сохранить изменения
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfigureWeightsModal;
