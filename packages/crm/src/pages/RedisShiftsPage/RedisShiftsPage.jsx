// packages/crm/src/pages/RedisShiftsPage/RedisShiftsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaPlus, FaFilter, FaChartBar, FaTimes, FaSearch } from 'react-icons/fa';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import Button from '../../../src/components/Button/Button';
import Select from '../../../src/components/Select/Select';
import ShiftCard from '../../components/ShiftCard/ShiftCard';
import classes from './RedisShiftsPage.module.css';
import Input from "../../components/Input/Input";

const RedisShiftsPage = () => {
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignees, setAssignees] = useState([]);

  // Фильтры
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState(null);
  const [searchEmail, setSearchEmail] = useState('');

  // Модальное окно создания смены
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState('department'); // 'department' или 'email'

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
    ttl: 86400 // 24 часа
  });

  const { setNotification } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  useEffect(() => {
    fetchDepartments();
    fetchShifts();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchAssigneesByDepartment(selectedDepartment);
    }
  }, [selectedDepartment]);

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('accessToken') || "3333";
      const response = await axios.get(URLS.GET_ACTIVE_DEPARTMENTS, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const deptOptions = response.data.data.map(dept => ({
        value: dept._id,
        label: dept.name,
        objectId: dept.ObjectId,
        taskTypeWeights: dept.taskTypeWeights,
        loadCalculationFormula: dept.loadCalculationFormula,
        defaultMaxLoad: dept.defaultMaxLoad,
        priorityMultiplier: dept.priorityMultiplier
      }));

      setDepartments(deptOptions);
    } catch (error) {
      console.error('Ошибка загрузки департаментов:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось загрузить департаменты',
        has: true
      });
    }
  };

  const fetchAssigneesByDepartment = async (departmentId) => {
    try {
      showLoader('Загрузка сотрудников...');
      const token = localStorage.getItem('accessToken') || "3333";
      const response = await axios.get(
        URLS.GET_WORK_SCHEDULE_BY_DEPARTMENT_ID(departmentId),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const assigneeOptions = response.data
        .map(schedule => ({
          value: schedule.accountId,
          label: schedule.assigneeName,
            email: schedule.assigneeEmail,
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

    const fetchShifts = async (depId) => {
        try {
            showLoader('Загрузка смен...');
            const token = localStorage.getItem('accessToken') || "3333";
            if (depId) {
                const depObjectId = departments.find(d => d.value === depId)?.objectId;
                const response = await axios.get(
                    URLS.GET_REDIS_SHIFTS_BY_DEPARTMENT(depObjectId),
                    {headers: {Authorization: `Bearer ${token}`}}
                );

                setShifts(response.data.data || []);
                hideLoader();
                return;
            }

            const response = await axios.get(URLS.GET_ALL_REDIS_SHIFTS, {
                headers: {Authorization: `Bearer ${token}`}
            });

            setShifts(response.data.data || []);
        } catch (error) {
            console.error('Ошибка загрузки смен:', error);
            setNotification({
                type: 'error',
                message: 'Не удалось загрузить смены',
                has: true
            });
        } finally {
            hideLoader();
        }
    };

  const handleOpenCreateModal = () => {

    setShowCreateModal(true);
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
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateMode('department');
  };

  // Поиск сотрудника по email через API
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

      // Ищем расписание по email
      const response = await axios.get(
        URLS.GET_WORK_SCHEDULES,
        { headers: { Authorization: `Bearer ${token}` } }
      );

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

      // Получаем данные департамента
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
      assigneeEmail: assignee.email
    }));
  };

  const handleCreateShift = async () => {
    // Валидация
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

      handleCloseCreateModal();
      fetchShifts();
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

  const handleDeleteShift = async (shift) => {

    try {
      showLoader('Удаление смены...');
      const token = localStorage.getItem('accessToken') || "3333";

      await axios.delete(
        URLS.DELETE_REDIS_SHIFT(shift.departmentObjectId, shift.accountId, shift.assigneeEmail),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotification({
        type: 'success',
        message: 'Смена удалена',
        has: true
      });

      fetchShifts();
    } catch (error) {
      console.error('Ошибка удаления:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось удалить смену',
        has: true
      });
    } finally {
      hideLoader();
    }
  };

  const handleIncrementTasks = async (shift) => {
    try {
      showLoader('Обновление счётчика...');
      const token = localStorage.getItem('accessToken') || "3333";

      await axios.patch(
        URLS.INCREMENT_REDIS_SHIFT(shift.departmentObjectId, shift.accountId, shift.assigneeEmail),
        { count: 1 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setNotification({
        type: 'success',
        message: 'Счётчик обновлён',
        has: true
      });

      fetchShifts();
    } catch (error) {
      console.error('Ошибка обновления:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось обновить счётчик',
        has: true
      });
    } finally {
      hideLoader();
    }
  };

  const getFilteredAssignees = () => {
    return assignees.filter(a => {
      const shiftExists = shifts.some(s =>
        s.departmentObjectId === newShift.departmentObjectId && s.accountId === a.value
      );
      return !shiftExists;
    });
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const filteredShifts = shifts.filter(shift => {
    if (selectedDepartment && shift.departmentId !== selectedDepartment) return false;
    if (selectedAssignee && shift.accountId !== selectedAssignee) return false;
    if (searchEmail && !String(shift.assigneeEmail).toLowerCase().includes(String(searchEmail).toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: shifts.length,
    filtered: filteredShifts.length,
    departments: new Set(shifts.map(s => s.departmentObjectId)).size
  };

  return (

      <div className={classes.page}>
        {/* Header */}
        <div className={classes.header}>
          <div>
            <h1>Поток заявок</h1>
            <p>Tут сотрудники на смене и готовы притупить к работе 😭</p>
          </div>
          <Button variant="primary" onClick={handleOpenCreateModal}>
            <FaPlus /> Добавить в пул
          </Button>
        </div>

        {/* Stats */}
        <div className={classes.stats}>
          <div className={classes.statCard}>
            <FaChartBar />
            <div>
              <span className={classes.statValue}>{stats.total}</span>
              <span className={classes.statLabel}>Всего смен</span>
            </div>
          </div>
          <div className={classes.statCard}>
            <FaFilter />
            <div>
              <span className={classes.statValue}>{stats.filtered}</span>
              <span className={classes.statLabel}>Отфильтровано</span>
            </div>
          </div>
          <div className={classes.statCard}>
            <FaChartBar />
            <div>
              <span className={classes.statValue}>{stats.departments}</span>
              <span className={classes.statLabel}>Департаментов</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={classes.filterPanel}>
          <div className={classes.filterHeader}>
            <h3><FaFilter /> Фильтры</h3>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedDepartment(null);
                setSelectedAssignee(null);
                setSearchEmail('');
              }}
            >
              Сбросить
            </Button>
          </div>
          <div className={classes.filters}>
            <div className={classes.filterRow}>

                <Select
                    label={'Департамент'}
                    options={departments}
                    width={'40%'}
                    size={'small'}
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e)}
                    placeholder="Все департаменты"
                />

                <Input
                    clearable={true}
                    label={'Email'}
                    width={'40%'}
                    type="text"
                    size={'small'}
                    placeholder="Поиск по email..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                />

            </div>
          </div>
        </div>

        {/* Shifts Grid */}
        <div className={classes.shiftsGrid}>
          {filteredShifts.length === 0 ? (
            <div className={classes.empty}>
              <h3>Смены не найдены</h3>
              <p>Попробуйте изменить фильтры или добавьте новую смену</p>
            </div>
          ) : (
            filteredShifts.map((shift, index) => (
              <ShiftCard
                key={`${shift.departmentObjectId}-${shift.accountId}-${index}`}
                shift={shift}
                onDelete={() => handleDeleteShift(shift)}
                onIncrement={() => handleIncrementTasks(shift)}
                formatDate={formatDate}
              />
            ))
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className={classes.modalOverlay} onClick={handleCloseCreateModal}>
            <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
              <div className={classes.modalHeader}>
                <h2>Добавить смену в пул</h2>
                <button className={classes.closeButton} onClick={handleCloseCreateModal}>
                  <FaTimes />
                </button>
              </div>

              <div className={classes.modalBody}>
                {/* Выбор режима */}
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
                    <label>
                      <span>Департамент *</span>
                      <Select
                        options={departments}
                        value={newShift.departmentId}
                        onChange={(e) => {
                            handleDepartmentChange(e);
                        }}
                        placeholder="Выберите департамент"
                      />
                    </label>

                    {newShift.departmentId && (
                        <Select
                            label={'Сотрудник *'}
                            options={getFilteredAssignees()}
                            value={newShift.accountId}
                            onChange={(e) => handleAssigneeChange(e)}
                            placeholder="Выберите сотрудника"
                        />

                    )}
                  </>
                ) : (
                  <div className={classes.emailSearch}>

                      <Input
                        type="email"
                        label={'Email сотрудника *'}
                        value={newShift.assigneeEmail}
                        onChange={(e) => setNewShift({ ...newShift, assigneeEmail: e.target.value })}
                        placeholder="user@example.com"
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

                    <div className={classes.timeRow}>


                        <Input
                            label={'Начало смены *'}
                          type="datetime-local"
                          value={newShift.shiftStartTime}
                          onChange={(e) => setNewShift({ ...newShift, shiftStartTime: e.target.value })}
                        />


                        <Input
                            label={'Конец смены *'}
                          type="datetime-local"
                          value={newShift.shiftEndTime}
                          onChange={(e) => setNewShift({ ...newShift, shiftEndTime: e.target.value })}
                        />

                    </div>

                    <div className={classes.numberRow}>

                        <Input
                            label={'Макс. нагрузка'}
                          type="number"
                          min="10"
                          max="500"
                          value={newShift.defaultMaxLoad}
                          onChange={(e) => setNewShift({ ...newShift, defaultMaxLoad: e.target.value })}
                        />



                        <Input
                            label={'Множитель приоритета'}
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5"
                          value={newShift.priorityMultiplier}
                          onChange={(e) => setNewShift({ ...newShift, priorityMultiplier: e })}
                        />


                        <Input
                            label={'TTL (секунды)'}
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
                <Button variant="secondary" onClick={handleCloseCreateModal}>
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
        )}
      </div>
  );
};

export default RedisShiftsPage;

