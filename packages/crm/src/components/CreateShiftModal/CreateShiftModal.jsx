import React, {useEffect, useState} from 'react';
import axios from 'axios';
import {URLS} from '../../utilities/urls';
import {FaSearch, FaTimes} from 'react-icons/fa';
import {useNotification} from '../../contexts/NotificationProvider';
import {useLoader} from '../../contexts/LoaderProvider';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Select from '../../components/Select/Select';
import classes from './CreateShiftModal.module.css';

const CreateShiftModal = ({ isOpen, onClose, onSuccess, departments, assigneesInPool }) => {
  const { setNotification } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  const [createMode, setCreateMode] = useState('department');
  const [assignees, setAssignees] = useState([]);
  const [newShift, setNewShift] = useState({
    departmentId: null,
    departmentObjectId: null,
    assigneeEmail: '',
    accountId: null,
    assigneeName: '',
    shiftStartTime: '',
    shiftEndTime: '',
    defaultMaxLoad: 100,
    priorityMultiplier: 1.0,
    taskTypeWeights: [],
    loadCalculationFormula: '',
    completedTasksCount: 0,
    ttl: 86400
  });

  useEffect(() => {
    if (newShift.shiftEndTime) {
      const calculatedTTL = calculateTTL(newShift.shiftEndTime);
      setNewShift(prev => ({ ...prev, ttl: calculatedTTL }));
    }
  }, [newShift.shiftEndTime]);

  const calculateTTL = (endTime) => {
    if (!endTime) return 86400;
    const endDate = new Date(endTime);
    const now = new Date();
    const diffInSeconds = Math.floor((endDate - now) / 1000);
    return Math.max(60, Math.min(604800, diffInSeconds));
  };

  const formatTTLDuration = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days} дн`);
    if (hours > 0) parts.push(`${hours} ч`);
    if (minutes > 0) parts.push(`${minutes} м`);
    return parts.length > 0 ? parts.join(' ') : `${seconds} сек`;
  };

  const fetchAssigneesByDepartment = async (departmentId) => {
    try {
      showLoader('Загрузка сотрудников...');
      const token = localStorage.getItem('accessToken') || "3333";
      const response = await axios.get(
        URLS.GET_WORK_SCHEDULE_BY_DEPARTMENT_ID(departmentId),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const assigneeOptions = response.data.map(schedule => ({
        value: schedule.accountId,
        label: schedule.assigneeName,
        email: schedule.assigneeEmail,
        limits: schedule.limits,
      }));

      setAssignees(assigneeOptions);
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось загрузить сотрудников',
        has: true
      });
    } finally {
      hideLoader();
    }
  };

  const handleSearchByEmail = async () => {
    if (!newShift.assigneeEmail) {
      setNotification({
        type: 'warning',
        message: 'Введите email сотрудника',
        has: true
      });
      return;
    }

    try {
      showLoader('Поиск сотрудника...');
      const token = localStorage.getItem('accessToken') || "3333";

      const response = await axios.get(URLS.GET_WORK_SCHEDULES, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const schedule = response.data.find(s =>
        s.assigneeEmail === newShift.assigneeEmail && s.isActive
      );

      if (!schedule) {
        setNotification({
          type: 'error',
          message: 'Сотрудник не найден или неактивен',
          has: true
        });
        return;
      }

      const deptResponse = await axios.get(
        URLS.GET_DEPARTMENT_BY_ID(schedule.department),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const dept = deptResponse.data.data;

      setNewShift(prev => ({
        ...prev,
        accountId: schedule.accountId,
        assigneeName: schedule.assigneeName,
        departmentId: dept._id,
        departmentObjectId: dept.ObjectId,
        taskTypeWeights: dept.taskTypeWeights || [],
        loadCalculationFormula: dept.loadCalculationFormula || '',
        defaultMaxLoad: dept.defaultMaxLoad || 100,
        priorityMultiplier: dept.priorityMultiplier || 1.0
      }));

      setNotification({
        type: 'success',
        message: `Найден: ${schedule.assigneeName} (${dept.name})`,
        has: true
      });
    } catch (error) {
      console.error('Ошибка поиска сотрудника:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось найти сотрудника',
        has: true
      });
    } finally {
      hideLoader();
    }
  };

  const handleDepartmentChange = (deptId) => {
    const dept = departments.find(d => d.value === deptId);
    if (!dept) return;

    setNewShift(prev => ({
      ...prev,
      departmentId: dept.value,
      departmentObjectId: dept.objectId,
      taskTypeWeights: dept.taskTypeWeights || [],
      loadCalculationFormula: dept.loadCalculationFormula || '',
      defaultMaxLoad: dept.defaultMaxLoad || 100,
      priorityMultiplier: dept.priorityMultiplier || 1.0
    }));

    fetchAssigneesByDepartment(deptId);
  };

  const handleAssigneeChange = (accountId) => {
    const assignee = assignees.find(a => a.value === accountId);
    if (!assignee) return;

    setNewShift(prev => ({
      ...prev,
      accountId: assignee.value,
      assigneeName: assignee.label,
      assigneeEmail: assignee.email,
      limits: assignee.limits,
    }));
  };

  const handleCreateShift = async () => {
    if (!newShift.departmentObjectId || !newShift.accountId || !newShift.assigneeEmail) {
      setNotification({
        type: 'warning',
        message: 'Заполните обязательные поля',
        has: true
      });
      return;
    }

    if (!newShift.shiftStartTime || !newShift.shiftEndTime) {
      setNotification({
        type: 'warning',
        message: 'Укажите время начала и окончания смены',
        has: true
      });
      return;
    }

    try {
      showLoader('Создание смены...');
      const token = localStorage.getItem('accessToken') || "3333";

      const payload = {
        departmentObjectId: newShift.departmentObjectId,
        accountId: newShift.accountId,
        departmentId: newShift.departmentId,
        assigneeEmail: newShift.assigneeEmail,
        assigneeName: newShift.assigneeName,
        taskTypeWeights: newShift.taskTypeWeights,
        limits: newShift.limits,
        loadCalculationFormula: newShift.loadCalculationFormula,
        defaultMaxLoad: parseInt(newShift.defaultMaxLoad),
        priorityMultiplier: parseFloat(newShift.priorityMultiplier),
        completedTasksCount: 0,
        shiftStartTime: new Date(newShift.shiftStartTime).toISOString(),
        shiftEndTime: new Date(newShift.shiftEndTime).toISOString(),
        ttl: parseInt(newShift.ttl)
      };

      await axios.post(URLS.CREATE_REDIS_SHIFT, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setNotification({
        type: 'success',
        message: 'Смена успешно создана',
        has: true
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Ошибка создания смены:', error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Не удалось создать смену',
        has: true
      });
    } finally {
      hideLoader();
    }
  };

  const getAssigneeNotInPool = () => {
    return assignees.filter(assignee => {
        return !assigneesInPool.some(poolAssignee => poolAssignee.accountId === assignee.value)
    })
  }

  const handleClose = () => {
    setNewShift({
      departmentId: null,
      departmentObjectId: null,
      assigneeEmail: '',
      accountId: null,
      assigneeName: '',
      shiftStartTime: '',
      shiftEndTime: '',
      defaultMaxLoad: 100,
      priorityMultiplier: 1.0,
      taskTypeWeights: [],
      loadCalculationFormula: '',
      completedTasksCount: 0,
      ttl: 86400
    });
    setCreateMode('department');
    setAssignees([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={classes.modalOverlay} onClick={handleClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.modalHeader}>
          <h2>Добавить смену в пул</h2>
          <button className={classes.closeButton} onClick={handleClose}>
            <FaTimes />
          </button>
        </div>

        <div className={classes.modalBody}>
          <div className={classes.modeSelector}>
            <label>
              <input
                type="radio"
                name="createMode"
                value="department"
                checked={createMode === 'department'}
                onChange={(e) => setCreateMode(e.target.value)}
              />
              Выбор по департаменту
            </label>
            <label>
              <input
                type="radio"
                name="createMode"
                value="email"
                checked={createMode === 'email'}
                onChange={(e) => setCreateMode(e.target.value)}
              />
              Поиск по email
            </label>
          </div>

          {createMode === 'department' ? (
            <>
              <Select
                label="Департамент"
                options={departments}
                value={newShift.departmentId}
                onChange={handleDepartmentChange}
                placeholder="Выберите департамент"
              />

              {newShift.departmentId && (
                <Select
                  label="Сотрудник"
                  options={getAssigneeNotInPool()}
                  value={newShift.accountId}
                  onChange={handleAssigneeChange}
                  placeholder="Выберите сотрудника"
                />
              )}
            </>
          ) : (<div className={classes.emailSearch}>
              <Input
                label="Email сотрудника"
                type="email"
                placeholder="example@domain.com"
                value={newShift.assigneeEmail}
                onChange={(e) => setNewShift({ ...newShift, assigneeEmail: e.target.value })}
              />
              <Button variant="secondary" onClick={handleSearchByEmail}>
                <FaSearch /> Найти
              </Button>
            </div>
          )}

          {newShift.accountId && (
            <>
              <div className={classes.infoBlock}>
                <p><strong>Департамент:</strong> {departments.find(d => d.value === newShift.departmentId)?.label}</p>
                <p><strong>Сотрудник:</strong> {newShift.assigneeName}</p>
                <p><strong>Email:</strong> {newShift.assigneeEmail}</p>
              </div>

              <div className={classes.timeSection}>
                <h4>Время смены</h4>
                <div className={classes.timeInputs}>
                  <Input
                    label="Начало смены"
                    type="datetime-local"
                    value={newShift.shiftStartTime}
                    onChange={(e) => setNewShift({ ...newShift, shiftStartTime: e.target.value })}
                  />
                  <Input
                    label="Окончание смены"
                    type="datetime-local"
                    value={newShift.shiftEndTime}
                    onChange={(e) => setNewShift({ ...newShift, shiftEndTime: e.target.value })}
                  />
                </div>
                {newShift.ttl && (
                  <p className={classes.ttlInfo}>
                    TTL: {formatTTLDuration(newShift.ttl)}
                  </p>
                )}
              </div>

              <div className={classes.numberRow}>
                <Input
                  label="Макс. нагрузка"
                  type="number"
                  min="1"
                  value={newShift.defaultMaxLoad}
                  onChange={(e) => setNewShift({ ...newShift, defaultMaxLoad: e.target.value })}
                />
                <Input
                  label="Множитель приоритета"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5"
                  value={newShift.priorityMultiplier}
                  onChange={(e) => setNewShift({ ...newShift, priorityMultiplier: e })}
                />
                <Input
                  label="TTL (секунды)"
                  disabled={true}
                  type="number"
                  min="3600"
                  value={newShift.ttl}
                  onChange={(e) => setNewShift({ ...newShift, ttl: e })}
                />
              </div>
            </>
          )}
        </div>

        <div className={classes.modalFooter}>
          <Button variant="secondary" onClick={handleClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateShift}
            disabled={!newShift.accountId || !newShift.shiftStartTime || !newShift.shiftEndTime}
          >
            Создать смену
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateShiftModal;
