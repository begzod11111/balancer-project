import React, { useState } from 'react';
import { FaUser, FaTrash, FaPlus, FaChevronDown, FaChevronUp, FaEdit, FaSave, FaTimes, FaClock } from 'react-icons/fa';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import { URLS } from '../../utilities/urls';
import axios from 'axios';
import classes from './ShiftCard.module.css';

const ShiftCard = ({ shift, onDelete, onIncrement, onUpdate, formatDate }) => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();

  const [showDetails, setShowDetails] = useState(false);
  const [isEditingLimits, setIsEditingLimits] = useState(false);
  const [editableLimits, setEditableLimits] = useState({
    maxDailyIssues: shift.limits?.maxDailyIssues || 30,
    maxActiveIssues: shift.limits?.maxActiveIssues || 30,
    preferredLoadPercent: shift.limits?.preferredLoadPercent || 80
  });



  const handleStartEditLimits = () => {
    setIsEditingLimits(true);
    setEditableLimits({
      maxDailyIssues: shift.limits?.maxDailyIssues || 30,
      maxActiveIssues: shift.limits?.maxActiveIssues || 30,
      preferredLoadPercent: shift.limits?.preferredLoadPercent || 80
    });
  };

  const handleCancelEditLimits = () => {
    setIsEditingLimits(false);
    setEditableLimits({
      maxDailyIssues: shift.limits?.maxDailyIssues || 30,
      maxActiveIssues: shift.limits?.maxActiveIssues || 30,
      preferredLoadPercent: shift.limits?.preferredLoadPercent || 80
    });
  };

  const handleLimitChange = (field, value) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    if (field === 'preferredLoadPercent' && numValue > 100) return;

    setEditableLimits(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSaveLimits = async () => {
    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.patch(
        URLS.UPDATE_REDIS_SHIFT_LIMITS(
          shift.departmentObjectId,
          shift.accountId,
          shift.assigneeEmail
        ),
        { limits: editableLimits },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        notify.success('Лимиты успешно обновлены');
        setIsEditingLimits(false);
        onUpdate?.(response.data.data);
      }
    } catch (error) {
      console.error('Ошибка обновления лимитов:', error);
      notify.error(error.response?.data?.message || 'Не удалось обновить лимиты');
    } finally {
      hideLoader();
    }
  };

  return (
    <div className={classes.shiftCard}>
      <div className={classes.cardHeader}>
        <div className={classes.assigneeInfo}>
          <div className={classes.avatar}>
            <FaUser />
          </div>
          <div className={classes.assigneeDetails}>
            <h3>{shift.assigneeName}</h3>
            <span className={classes.email}>{shift.assigneeEmail}</span>
            <span className={classes.badge}>
              Dept: {shift.departmentObjectId}
            </span>
          </div>
        </div>
        <div className={classes.completedBadge}>
          <FaPlus />
          <span>{shift.completedTasksCount || 0} выполнено</span>
        </div></div>

      <div className={classes.cardBody}>
        <div className={classes.infoRow}>
          <span className={classes.label}>Account ID:</span>
          <span className={classes.value}>{shift.accountId}</span>
        </div>

        <div className={classes.infoRow}>
          <span className={classes.label}>Макс. нагрузка:</span>
          <span className={classes.value}>{shift.defaultMaxLoad}</span>
        </div>

        <div className={classes.infoRow}>
          <span className={classes.label}>Множитель приоритета:</span>
          <span className={classes.value}>{shift.priorityMultiplier}</span>
        </div>

        <div className={classes.timeInfo}>
          <FaClock className={classes.clockIcon} />
          <div className={classes.timeBlock}>
            <span className={classes.timeLabel}>Начало:</span>
            <span className={classes.timeValue}>
              {formatDate(shift.shiftStartTime)}
            </span>
          </div>
          <span className={classes.timeDivider}>→</span>
          <div className={classes.timeBlock}>
            <span className={classes.timeLabel}>Конец:</span>
            <span className={classes.timeValue}>
              {formatDate(shift.shiftEndTime)}
            </span>
          </div>
        </div>

        {/* Лимиты */}
        <div className={classes.limitsSection}>
          <div className={classes.limitsSectionHeader}>
            <h4>Лимиты нагрузки</h4>
            {!isEditingLimits && (
              <button
                className={classes.editLimitsBtn}
                onClick={handleStartEditLimits}
              >
                <FaEdit /> Изменить
              </button>
            )}
          </div>

          {isEditingLimits ? (
            <div className={classes.editLimitsForm}>
              <div className={classes.limitInput}>
                <label>Макс. задач в день:</label>
                <Input
                  type="number"
                  value={editableLimits.maxDailyIssues}
                  onChange={(e) => handleLimitChange('maxDailyIssues', e.target.value)}
                  min="0"
                />
              </div>
              <div className={classes.limitInput}>
                <label>Макс. активных задач:</label>
                <Input
                  type="number"
                  value={editableLimits.maxActiveIssues}
                  onChange={(e) => handleLimitChange('maxActiveIssues', e.target.value)}
                  min="0"
                />
              </div>
              <div className={classes.limitInput}>
                <label>Предпочтительная загрузка (%):</label>
                <Input
                  type="number"
                  value={editableLimits.preferredLoadPercent}
                  onChange={(e) => handleLimitChange('preferredLoadPercent', e.target.value)}
                  min="0"
                  max="100"
                />
              </div>
              <div className={classes.editLimitsActions}>
                <Button icon={<FaSave />} onClick={handleSaveLimits}>
                  Сохранить
                </Button>
                <Button variant="secondary" icon={<FaTimes />} onClick={handleCancelEditLimits}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div className={classes.limitsGrid}>
              <div className={classes.limitItem}>
                <span className={classes.limitLabel}>Макс. задач в день</span>
                <span className={classes.limitValue}>{shift.limits?.maxDailyIssues || 0}</span>
              </div>
              <div className={classes.limitItem}>
                <span className={classes.limitLabel}>Макс. активных</span>
                <span className={classes.limitValue}>{shift.limits?.maxActiveIssues || 0}</span>
              </div>
              <div className={classes.limitItem}>
                <span className={classes.limitLabel}>Загрузка</span>
                <span className={classes.limitValue}>{shift.limits?.preferredLoadPercent || 0}%</span>
              </div>
            </div>
          )}
        </div>

        <div className={classes.formula}>
          <span className={classes.formulaLabel}>Формула расчёта:</span>
          <code className={classes.formulaCode}>{shift.loadCalculationFormula}</code>
        </div>

        <button
          className={classes.toggleDetails}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? <FaChevronUp /> : <FaChevronDown />}
          {showDetails ? 'Скрыть типы задач' : 'Показать типы задач'}
        </button>

        {showDetails && shift.taskTypeWeights && shift.taskTypeWeights.length > 0 && (
          <div className={classes.taskTypes}>
            <h4>Типы задач и веса:</h4>
            <div className={classes.typesList}>
              {shift.taskTypeWeights.map((type) => (
                <div key={type._id} className={classes.typeItem}>
                  <div className={classes.typeHeader}>
                    <span className={classes.typeName}>{type.name}</span>
                    <span className={classes.typeWeight}>Вес: {type.weight}</span>
                  </div>
                  {type.statusWeights && type.statusWeights.length > 0 && (
                    <div className={classes.statusWeights}>
                      <span className={classes.statusLabel}>Статусы:</span>
                      {type.statusWeights.map((status) => (
                        <div key={status._id} className={classes.statusItem}>
                          <span>{status.statusName}</span>
                          <span className={classes.statusWeight}>Вес: {status.weight}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={classes.cardFooter}>
        <div className={classes.timestamps}>
          <span>Создано: {formatDate(shift.createdAt)}</span>
          <span>Обновлено: {formatDate(shift.updatedAt)}</span>
        </div>

        <div className={classes.actions}>
          <Button
            variant="primary"
            onClick={() => onIncrement(shift.departmentObjectId, shift.accountId, shift.assigneeEmail)}
          >
            <FaPlus /> Увеличить счётчик
          </Button>
          <Button
            variant="danger"
            onClick={() => onDelete(shift.departmentObjectId, shift.accountId, shift.assigneeEmail)}
          >
            <FaTrash /> Удалить
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShiftCard;
