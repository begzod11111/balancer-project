// packages/crm/src/components/ShiftCard/ShiftCard.jsx
import React, { useState } from 'react';
import { FaUser, FaTrash, FaPlus, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import Button from '../../../src/components/Button/Button';
import classes from './ShiftCard.module.css';

const ShiftCard = ({ shift, onDelete, onIncrement, formatDate }) => {
  const [showDetails, setShowDetails] = useState(false);

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
          </div>
        </div>
        <span className={classes.badge}>
          Dept: {shift.departmentObjectId}
        </span>
      </div>

      <div className={classes.cardBody}>
        <div className={classes.infoRow}>
          <span className={classes.label}>Account ID:</span>
          <span className={classes.value}>{shift.accountId}</span>
        </div>

        <div className={classes.infoRow}>
          <span className={classes.label}>Выполнено задач:</span>
          <span className={classes.value}>{shift.completedTasksCount || 0}</span>
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
          <div className={classes.timeBlock}>
            <span className={classes.timeLabel}>Начало смены:</span>
            <span className={classes.timeValue}>
              {formatDate(shift.shiftStartTime)}
            </span>
          </div>
          <div className={classes.timeBlock}>
            <span className={classes.timeLabel}>Конец смены:</span>
            <span className={classes.timeValue}>
              {shift.shiftEndTime ? formatDate(shift.shiftEndTime) : 'В процессе'}
            </span>
          </div>
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
                <div key={type.typeId || type._id} className={classes.typeItem}>
                  <span className={classes.typeName}>{type.name}</span>
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
