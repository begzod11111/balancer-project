import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaTimes, FaPlus, FaTrash, FaSave, FaSearch, FaSync, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import Button from '../Button/Button';
import Input from '../Input/Input';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './ManageStatusesModal.module.css';

const ManageStatusesModal = ({ type, onClose, onUpdate }) => {
  const { notify } = useNotification();
  const loader = useLoader();
  const [statuses, setStatuses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [newStatus, setNewStatus] = useState({
    name: '',
    id: '',
    untranslatedName: ''
  });

  useEffect(() => {
    if (type?.statuses) {
      setStatuses(type.statuses);
    }
  }, [type]);

  const filteredStatuses = statuses.filter(status =>
    status.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    status.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddStatus = () => {
    if (!newStatus.name.trim() || !newStatus.id.trim()) {
      notify.error('Заполните все поля статуса');
      return;
    }

    const exists = statuses.some(s => s.id === newStatus.id);
    if (exists) {
      notify.error('Статус с таким ID уже существует');
      return;
    }

    setStatuses(prev => [...prev, { ...newStatus, self: '' }]);
    setNewStatus({ name: '', id: '', untranslatedName: '' });
    setValidationResult(null);
    notify.success('Статус добавлен');
  };

  const handleRemoveStatus = (statusId) => {
    setStatuses(prev => prev.filter(s => s.id !== statusId));
    setValidationResult(null);
    notify.success('Статус удалён');
  };

  const handleValidate = async () => {
    try {
      loader.showLoader('Проверка статусов в Jira...');

      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        URLS.VALIDATE_TYPE_STATUSES(type._id),
        { statuses },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const result = response.data.data;
        setValidationResult(result);

        if (result.invalid.length === 0) {
          notify.success('Все статусы валидны в Jira');
        } else {
          notify.warning(`Найдено ${result.invalid.length} невалидных статусов`);
        }
      }
    } catch (error) {
      console.error('Ошибка проверки статусов:', error);
      notify.error(error.response?.data?.message || 'Ошибка при проверке статусов');
    } finally {
      loader.hideLoader();
    }
  };

  const handleSync = async () => {
    try {
      loader.showLoader('Синхронизация с Jira...');

      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        URLS.SYNC_TYPE_STATUSES(type._id),
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        const updatedType = response.data.data;
        setStatuses(updatedType.statuses);
        setValidationResult(null);
        notify.success(`Синхронизировано ${updatedType.statuses.length} статусов`);
        onUpdate();
      } else {
        notify.error('Не удалось синхронизировать статусы');
      }
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
      notify.error(error.response?.data?.message || 'Ошибка при синхронизации');
    } finally {
      loader.hideLoader();
    }
  };

  const handleSave = async () => {
    try {
      loader.showLoader('Сохранение статусов...');

      const token = localStorage.getItem('accessToken');
      const response = await axios.put(
        URLS.UPDATE_TYPE_STATUSES(type._id),
        {
          statuses,
          validateFromJira: false // Можно сделать чекбокс для этой опции
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        notify.success('Статусы успешно обновлены');
        setValidationResult(null);
        onUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Ошибка обновления статусов:', error);
      notify.error(error.response?.data?.message || 'Ошибка при обновлении статусов');
    } finally {
      loader.hideLoader();
    }
  };

  const isValidStatus = (statusId) => {
    if (!validationResult) return null;
    return validationResult.valid.some(s => s.id === statusId);
  };

  const isInvalidStatus = (statusId) => {
    if (!validationResult) return null;
    return validationResult.invalid.some(s => s.id === statusId);
  };

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <div>
            <h2>Управление статусами</h2>
            <p className={classes.subtitle}>
              {type?.name} ({statuses.length} статусов)
            </p>
          </div>
          <button className={classes.closeButton} onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className={classes.content}>
          <div className={classes.toolbar}>
            <Button
              variant="secondary"
              icon={<FaSync />}
              onClick={handleSync}
            >
              Синхронизировать с Jira
            </Button>
            <Button
              variant="secondary"
              icon={<FaCheckCircle />}
              onClick={handleValidate}
            >
              Проверить в Jira
            </Button>
          </div>

          {validationResult && validationResult.invalid.length > 0 && (
            <div className={classes.validationWarning}>
              <FaExclamationCircle />
              <span>
                Найдено {validationResult.invalid.length} невалидных статусов: {' '}
                {validationResult.invalid.map(s => s.name).join(', ')}
              </span>
            </div>
          )}

          <div className={classes.addSection}>
            <h3>Добавить статус</h3>
            <div className={classes.addForm}>
              <Input
                value={newStatus.name}
                onChange={(e) => setNewStatus(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Название статуса"
              />
              <Input
                value={newStatus.id}
                onChange={(e) => setNewStatus(prev => ({ ...prev, id: e.target.value }))}
                placeholder="ID статуса"
              />
              <Input
                value={newStatus.untranslatedName}
                onChange={(e) => setNewStatus(prev => ({ ...prev, untranslatedName: e.target.value }))}
                placeholder="Оригинальное название"
              />
              <Button icon={<FaPlus />} onClick={handleAddStatus}>
                Добавить
              </Button>
            </div>
          </div>

          <div className={classes.searchSection}>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск статусов..."
              icon={<FaSearch />}
            />
          </div>

          <div className={classes.statusList}>
            {filteredStatuses.length === 0 ? (
              <div className={classes.empty}>
                <p>Нет статусов</p>
              </div>
            ) : (
              filteredStatuses.map((status) => (
                <div
                  key={status.id}
                  className={`${classes.statusItem} ${
                    isValidStatus(status.id) ? classes.valid : 
                    isInvalidStatus(status.id) ? classes.invalid : ''
                  }`}
                >
                  <div className={classes.statusInfo}>
                    <div className={classes.statusName}>
                      {status.name}{isValidStatus(status.id) && (
                        <FaCheckCircle className={classes.validIcon} />
                      )}{isInvalidStatus(status.id) && (
                        <FaExclamationCircle className={classes.invalidIcon} />
                      )}
                    </div>
                    <div className={classes.statusId}>ID: {status.id}</div>
                    {status.untranslatedName && (
                      <div className={classes.statusOriginal}>
                        {status.untranslatedName}
                      </div>
                    )}
                  </div>
                  <button
                    className={classes.deleteButton}
                    onClick={() => handleRemoveStatus(status.id)}
                  >
                    <FaTrash />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={classes.footer}>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button icon={<FaSave />} onClick={handleSave}>
            Сохранить изменения
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ManageStatusesModal;
