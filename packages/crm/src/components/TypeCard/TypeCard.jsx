import React from 'react';
import { FaEdit, FaTrash, FaCheck, FaTimes, FaBuilding } from 'react-icons/fa';
import Button from '../Button/Button';
import classes from './TypeCard.module.css';

const TypeCard = ({ type, onEdit, onDelete, onToggleStatus }) => {
  const getCategoryColor = (category) => {
    const colors = {
      task: '#4CAF50',
      bug: '#f44336',
      story: '#2196F3',
      epic: '#9C27B0'
    };
    return colors[category] || '#757575';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      task: 'Задача',
      bug: 'Баг',
      story: 'История',
      epic: 'Эпик'
    };
    return labels[category] || category;
  };

  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <div className={classes.titleSection}>
          {type.icon && <span className={classes.icon}>{type.icon}</span>}
          <div>
            <h3 className={classes.title}>{type.name}</h3>
            <span className={classes.typeId}>ID: {type.typeId}</span>
          </div>
        </div>
        <div className={classes.badges}>
          <span
            className={classes.categoryBadge}
            style={{ background: getCategoryColor(type.category) }}
          >
            {getCategoryLabel(type.category)}
          </span>
          <span className={`${classes.statusBadge} ${type.active ? classes.active : classes.inactive}`}>
            {type.active ? <><FaCheck /> Активен</> : <><FaTimes /> Неактивен</>}
          </span>
        </div>
      </div>

      <div className={classes.body}>
        {type.description && (
          <p className={classes.description}>{type.description}</p>
        )}

        <div className={classes.info}>
          <div className={classes.infoItem}>
            <span className={classes.label}>Вес по умолчанию</span>
            <span className={classes.weight}>{type.defaultWeight.toFixed(1)}</span>
          </div>

          {type.color && (
            <div className={classes.infoItem}>
              <span className={classes.label}>Цвет</span>
              <div className={classes.colorPreview} style={{ background: type.color }} />
            </div>
          )}
        </div>

        {type.departments && type.departments.length > 0 && (
          <div className={classes.departments}>
            <div className={classes.departmentsHeader}>
              <FaBuilding />
              <span>Связанные отделы ({type.departments.length})</span>
            </div>
            <div className={classes.departmentsList}>
              {type.departments.map(dept => (
                <div key={dept._id} className={classes.departmentItem}>
                  <span className={classes.deptName}>{dept.name}</span>
                  {dept.weight && (
                    <span className={classes.deptWeight}>
                      Вес: {dept.weight.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={classes.footer}>
        <div className={classes.meta}>
          <span>Создан: {new Date(type.createdAt).toLocaleDateString('ru-RU')}</span>
          <span>Обновлён: {new Date(type.updatedAt).toLocaleDateString('ru-RU')}</span>
        </div>
        <div className={classes.actions}>
          <Button
            variant="secondary"
            size="small"
            icon={<FaEdit />}
            onClick={() => onEdit(type)}
          >
            Изменить
          </Button>
          <Button
            variant={type.active ? 'warning' : 'success'}
            size="small"
            onClick={() => onToggleStatus(type._id, type.active)}
          >
            {type.active ? 'Деактивировать' : 'Активировать'}
          </Button>
          <Button
            variant="danger"
            size="small"
            icon={<FaTrash />}
            onClick={() => onDelete(type._id)}
          >
            Удалить
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TypeCard;
