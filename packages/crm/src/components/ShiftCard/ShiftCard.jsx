import React, { useState, useEffect } from 'react';
import { FaUser, FaTrash, FaPlus, FaChevronDown, FaChevronUp, FaEdit, FaSave, FaTimes, FaClock, FaHourglassHalf } from 'react-icons/fa';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import { URLS } from '../../utilities/urls';
import axios from 'axios';
import classes from './ShiftCard.module.css';
import CircularClock from "../CircularClock/CircularClock";

const ShiftCard = ({ shift, onDelete, onIncrement, onUpdate, formatDate, ttl }) => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();

  const [showDetails, setShowDetails] = useState(false);
  const [isEditingLimits, setIsEditingLimits] = useState(false);
  const [editableLimits, setEditableLimits] = useState({
    maxDailyIssues: shift.limits?.maxDailyIssues || 30,
    maxActiveIssues: shift.limits?.maxActiveIssues || 30,
    preferredLoadPercent: shift.limits?.preferredLoadPercent || 80
  });

    const formatTTL = (seconds) => {
        if (seconds <= 0) return '0 сек';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}ч`);
        if (minutes > 0) parts.push(`${minutes}м`);
        parts.push(`${secs}с`);

        return parts.join(' ');
    };
    const getTTLBadgeClass = (percent) => {
        if (percent <= 0) return classes.ttlExpired;
        if (percent <= 25) return classes.ttlExpired;
        if (percent <= 50) return classes.ttlWarning;
        if (percent <= 75) return classes.ttlNormal;
        return classes.ttlGood;
    };

    const getTTLColor = (percent) => {
        if (percent <= 0) return 'var(--color-error)';
        if (percent <= 25) return 'var(--color-error)';
        if (percent <= 50) return 'var(--color-warning)';
        if (percent <= 75) return 'var(--color-info)';
        return 'var(--color-success)';
    };

        // Добавьте функцию для анимированного отображения времени
    const renderAnimatedTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      return (
        <span className={classes.ttlTime}>
          {hours > 0 && (
            <>
              <span style={{ fontSize: '1em' }}>{hours}</span>
              <span style={{ fontSize: '0.8em' }}>ч</span>
              <span style={{ margin: '0 2px' }}> </span>
            </>
          )}
          {minutes > 0 && (
            <>
              <span style={{ fontSize: '1em' }}>{minutes}</span>
              <span style={{ fontSize: '0.8em' }}>м</span>
              <span style={{ margin: '0 2px' }}> </span>
            </>
          )}
          <span style={{ fontSize: '1em' }}>{secs}</span>
          <span style={{ fontSize: '0.8em' }}>с</span>
        </span>
      );
    };

  // TTL countdown state
  const [timeRemaining, setTimeRemaining] = useState(ttl || 0);
  const [ttlPercent, setTtlPercent] = useState(100);

  // Calculate initial TTL (24 hours in seconds)
  const initialTTL = 24 * 60 * 60;

  useEffect(() => {
    if (ttl > 0) {
      setTimeRemaining(ttl);
      setTtlPercent((ttl / initialTTL) * 100);

      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            clearInterval(interval);
            return 0;
          }
          setTtlPercent((newTime / initialTTL) * 100);
          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [ttl]);





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
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
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
      {/* TTL Progress Bar */}
          <div className={classes.ttlBar}>
      <div
        className={classes.ttlProgress}
        style={{
          width: `${Math.max(0, Math.min(100, ttlPercent))}%`,
          color: getTTLColor(ttlPercent)
        }}
      /></div>

       <div className={classes.cardHeader}>
      <div className={classes.assigneeInfo}>
        <div className={classes.avatar}>
          <FaUser />
        </div>
        <div className={classes.assigneeDetails}>
          <h3>{shift.assigneeName}</h3>
          <span className={classes.email}>{shift.assigneeEmail}</span>
          <span className={classes.badge}>
            {shift.departmentName}
          </span>
        </div>
      </div>
    </div>


      <div className={classes.cardBody}>
           <CircularClock seconds={timeRemaining} percent={ttlPercent} />
        <div className={classes.infoRow}>
          <span className={classes.label}>Account ID:</span>
          <span className={classes.value}>{shift.accountId}</span>
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
                <FaEdit /> Редактировать
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
                <Button variant="secondary" onClick={handleCancelEditLimits}>
                  <FaTimes /> Отмена
                </Button>
                <Button variant="primary" onClick={handleSaveLimits}>
                  <FaSave /> Сохранить
                </Button>
              </div>
            </div>
          ) : (
            <div className={classes.limitsGrid}>
              <div className={classes.limitItem}>
                <span className={classes.limitLabel}>Макс. в день</span>
                <strong className={classes.limitValue}>
                  {shift.limits?.maxDailyIssues || 30}
                </strong>
              </div>
              <div className={classes.limitItem}>
                <span className={classes.limitLabel}>Макс. активных</span>
                <strong className={classes.limitValue}>
                  {shift.limits?.maxActiveIssues || 30}
                </strong>
              </div>
              <div className={classes.limitItem}>
                <span className={classes.limitLabel}>Загрузка</span>
                <strong className={classes.limitValue}>
                  {shift.limits?.preferredLoadPercent || 80}%
                </strong>
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
              {shift.taskTypeWeights.map(type => (
                <div key={type._id} className={classes.typeItem}>
                  <div className={classes.typeContent}>
                    <span className={classes.typeName}>{type.name}</span>
                    {type.statusWeights && type.statusWeights.length > 0 && (
                      <div className={classes.statusWeights}>
                        <span className={classes.statusLabel}>Веса статусов:</span>
                        {type.statusWeights.map(status => (
                          <div key={status._id} className={classes.statusItem}>
                            <span>{status.statusName}</span>
                            <span className={classes.statusWeight}>
                              Вес: {status.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={classes.typeWeight}>Вес: {type.weight}</span>
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
