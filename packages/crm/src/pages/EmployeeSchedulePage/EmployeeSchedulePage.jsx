import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaClock, FaEdit, FaPlus, FaTrash, FaSearch, FaRedo, FaFilter, FaUserPlus, FaCheck, FaTimes, FaSave } from 'react-icons/fa';
import Select from "../../components/Select/Select";
import Button from "../../components/Button/Button";
import { useNotification } from "../../contexts/NotificationProvider";
import { useLoader } from "../../contexts/LoaderProvider";
import classes from './EmployeeSchedulePage.module.css';
import CreateScheduleModal from '../../components/CreateScheduleModal/CreateScheduleModal';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];


const EmployeeSchedulePage = (callback, deps) => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();

  const [schedules, setSchedules] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [searchType, setSearchType] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [editScheduleId, setEditScheduleId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [departments, setDepartments] = useState([]);

  const [filters, setFilters] = useState({
    isActive: null,
    deleted: false,
    departmentId: null,
    assigneeEmail: '',
    limit: 50,
    skip: 0,
    sort: 'updatedAt'
  });

    const handleCreateSuccess = (newSchedule) => {
        setSchedules(prev => [newSchedule, ...prev]);
    };

  const [editableSchedule, setEditableSchedule] = useState({
    shifts: {},
    limits: { maxDailyIssues: 30, maxActiveIssues: 30, preferredLoadPercent: 80 }
  });

    const fetchDepartments = useCallback(async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await axios.get(URLS.GET_DEPARTMENTS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Преобразуем данные в формат для селекта
            const departments = response.data.data.map(dept => ({
                value: dept._id,
                label: dept.name
            }));
            setDepartments(departments);
        } catch (e) {
            console.error('Ошибка загрузки отделов:', e);
            notify.error('Не удалось загрузить отделы');
        }
    });

    useEffect(() => {
        fetchDepartments();
    }, []);

  const fetchSchedules = useCallback(async () => {
    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const params = {};

      // Добавляем параметры только если они установлены
      if (filters.isActive !== null) params.isActive = filters.isActive;
      if (filters.deleted) params.deleted = filters.deleted;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.assigneeEmail) params.assigneeEmail = filters.assigneeEmail;
      if (filters.limit) params.limit = filters.limit;
      if (filters.skip) params.skip = filters.skip;
      if (filters.sort) params.sort = filters.sort;

      const response = await axios.get(URLS.GET_WORK_SCHEDULES, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setSchedules(response.data);

      // Формируем список сотрудников для селекта
      setAssignees(response.data.map(s => ({
        value: s.accountId,
        label: `${s.assigneeName || 'Без имени'} (${s.assigneeEmail})`
      })));
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      notify.error('Не удалось загрузить расписания');
    } finally {
      hideLoader();
    }
  }, [filters, showLoader, hideLoader, notify]);

  // Загружаем только при монтировании
  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleSearch = async () => {
    if (searchType === 'account' && !selectedId) {
      notify.warning('Выберите сотрудника для поиска');
      return;
    }

    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      let url = URLS.GET_WORK_SCHEDULES;
      let params = {};

      if (searchType === 'all') {
        // Применяем все фильтры
        if (filters.isActive !== null) params.isActive = filters.isActive;
        if (filters.deleted) params.deleted = filters.deleted;
        if (filters.departmentId) params.departmentId = filters.departmentId;
        if (filters.assigneeEmail) params.assigneeEmail = filters.assigneeEmail;
        params.limit = filters.limit;
        params.skip = filters.skip;
        params.sort = filters.sort;
      } else if (searchType === 'account') {
        url = `${URLS.GET_WORK_SCHEDULES}/account/${selectedId}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      const data = Array.isArray(response.data) ? response.data : [response.data];
      setSchedules(data);

      if (data.length === 0) {
        notify.info('Расписания не найдены');
      }
    } catch (error) {
      console.error('Ошибка поиска:', error);
      notify.error('Не удалось найти расписание');
      setSchedules([]);
    } finally {
      hideLoader();
    }
  };

  const handleReset = () => {
    setSearchType('all');
    setSelectedId(null);
    setFilters({
      isActive: null,
      deleted: false,
      departmentId: null,
      assigneeEmail: '',
      limit: 50,
      skip: 0,
      sort: 'updatedAt'
    });
    fetchSchedules();
  };

  const handleApplyFilters = () => {
    fetchSchedules();
  };

  const handleToggleActive = async (scheduleId, currentStatus) => {
    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      await axios.patch(
        `${URLS.GET_WORK_SCHEDULES}/${scheduleId}/active`,
        { isActive: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSchedules(prev => prev.map(s =>
        s._id === scheduleId ? { ...s, isActive: !currentStatus } : s
      ));

      notify.success(`Расписание ${!currentStatus ? 'активировано' : 'деактивировано'}`);
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      notify.error('Не удалось изменить статус');
    } finally {
      hideLoader();
    }
  };

  const handleEditSchedule = (schedule) => {
    setEditScheduleId(schedule._id);
    setEditableSchedule({
      shifts: schedule.shifts || {},
      limits: schedule.limits || { maxDailyIssues: 30, maxActiveIssues: 30, preferredLoadPercent: 80 }
    });
  };

  const handleCancelEdit = () => {
    setEditScheduleId(null);
    setEditableSchedule({
      shifts: {},
      limits: { maxDailyIssues: 30, maxActiveIssues: 30, preferredLoadPercent: 80 }
    });
  };

  const handleSaveSchedule = async () => {
    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      await axios.put(
        `${URLS.GET_WORK_SCHEDULES}/${editScheduleId}`,
        editableSchedule,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSchedules(prev => prev.map(s =>
        s._id === editScheduleId ? { ...s, ...editableSchedule } : s
      ));

      handleCancelEdit();
      notify.success('Расписание обновлено');
    } catch (error) {
      console.error('Ошибка обновления:', error);
      notify.error('Не удалось обновить расписание');
    } finally {
      hideLoader();
    }
  };

  const handleShiftChange = (day, field, value) => {
    setEditableSchedule(prev => ({
      ...prev,
      shifts: {
        ...prev.shifts,
        [day]: {
          ...prev.shifts[day],
          [field]: value
        }
      }
    }));
  };

  const handleAddShift = () => {
    // Ищем первый незаполненный день (от 0 до 6)
    const emptyDayIndex = [0, 1, 2, 3, 4, 5, 6].find(i => !editableSchedule.shifts[i]);

    if (emptyDayIndex !== undefined) {
      handleShiftChange(emptyDayIndex, 'startTime', '09:00');
      handleShiftChange(emptyDayIndex, 'endTime', '18:00');
      notify.success(`Добавлена смена на ${DAYS[emptyDayIndex]}`);
    } else {
      notify.warning('Все дни недели уже заполнены');
    }
  };

  const handleDeleteShift = (day) => {
    setEditableSchedule(prev => {
      const { [day]: removed, ...shifts } = prev.shifts;
      return { ...prev, shifts };
    });
    notify.success('Смена удалена');
  };

  const handleLimitChange = (field, value) => {
    setEditableSchedule(prev => ({
      ...prev,
      limits: {
        ...prev.limits,
        [field]: parseInt(value, 10) || 0
      }
    }));
  };

  const searchOptions = [
    { value: 'all', label: 'Все расписания' },
    { value: 'account', label: 'По сотруднику' }
  ];

  const statusOptions = [
    { value: null, label: 'Все статусы' },
    { value: true, label: 'Только активные' },
    { value: false, label: 'Только неактивные' }
  ];

  const sortOptions = [
    { value: 'updatedAt', label: 'По дате обновления' },
    { value: 'createdAt', label: 'По дате создания' },
    { value: 'assigneeName', label: 'По имени сотрудника' }
  ];

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h1><FaClock /> Управление расписаниями</h1>
          <p>Настройка рабочего времени сотрудников</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true) } icon={<FaUserPlus />}>
          Добавить расписание
        </Button>
      </header>

      <div className={classes.filterPanel}>
        <div className={classes.filterHeader}>
          <h3>Фильтры и поиск</h3>
          <Button
            variant="secondary"
            icon={<FaFilter />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Скрыть' : 'Показать'} фильтры
          </Button>
        </div>

        {showFilters && (
          <div className={classes.advancedFilters}>
            <div className={classes.filterRow}>
              <label>
                <span>Статус активности</span>
                <Select
                  options={statusOptions}
                  value={filters.isActive}
                  onChange={(value) => setFilters(prev => ({ ...prev, isActive: value }))}
                  placeholder="Выберите статус"
                />
              </label>

              <label>
                <span>Отдел</span>
                <Select
                  options={[{ value: null, label: 'Все отделы' }, ...departments]}
                  value={filters.departmentId}
                  onChange={(value) => setFilters(prev => ({ ...prev, departmentId: value }))}
                  placeholder="Выберите отдел"
                />
              </label>
            </div>

            <div className={classes.filterRow}>
              <label>
                <span>Email сотрудника</span>
                <input
                  type="email"
                  value={filters.assigneeEmail}
                  onChange={(e) => setFilters(prev => ({ ...prev, assigneeEmail: e.target.value }))}
                  placeholder="Введите email"
                  className={classes.filterInput}
                />
              </label>

              <label>
                <span>Сортировка</span>
                <Select
                  options={sortOptions}
                  value={filters.sort}
                  onChange={(value) => setFilters(prev => ({ ...prev, sort: value }))}
                />
              </label>
            </div>

            <div className={classes.filterRow}>
              <label className={classes.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={filters.deleted}
                  onChange={(e) => setFilters(prev => ({ ...prev, deleted: e.target.checked }))}
                />
                Показать удалённые
              </label>

              <label>
                <span>Количество записей</span>
                <input
                  type="number"
                  min="0"
                  value={filters.limit}
                  onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value, 10) || 0 }))}
                  className={classes.filterInput}
                />
              </label>
            </div>

            <div className={classes.filterActions}>
              <Button onClick={handleApplyFilters} icon={<FaCheck />}>
                Применить фильтры
              </Button>
              <Button variant="secondary" onClick={handleReset} icon={<FaRedo />}>
                Сбросить всё
              </Button>
            </div>
          </div>
        )}

        <div className={classes.searchRow}>
          <Select
            options={searchOptions}
            value={searchType}
            onChange={setSearchType}
            placeholder="Тип поиска"
          />
          {searchType === 'account' && (
            <Select
              options={assignees}
              value={selectedId}
              onChange={setSelectedId}
              placeholder="Выберите сотрудника"
            />
          )}
          <Button onClick={handleSearch} icon={<FaSearch />}>
            Поиск
          </Button>
        </div>
      </div>

      <div className={classes.list}>
        {schedules.length === 0 ? (
          <div className={classes.empty}>
            <FaClock size={48} />
            <h3>Расписания не найдены</h3>
            <p>Попробуйте изменить параметры поиска или создайте новое расписание</p>
          </div>
        ) : (
          schedules.map(schedule => (
            <div key={schedule._id} className={classes.card}>
              <div className={classes.cardHeader}>
                <div className={classes.userInfo}>
                  <h3>{schedule.assigneeName || 'Без имени'}</h3>
                  <span className={classes.email}>{schedule.assigneeEmail}</span>
                  <span className={`${classes.badge} ${schedule.isActive ? classes.active : classes.inactive}`}>
                    {schedule.isActive ? <><FaCheck /> Активно</> : <><FaTimes /> Неактивно</>}
                  </span>
                </div>
                <div className={classes.actions}>
                  <Button
                    variant="secondary"
                    icon={<FaEdit />}
                    onClick={() => handleEditSchedule(schedule)}
                    disabled={editScheduleId === schedule._id}
                  >
                    Изменить
                  </Button>
                  <Button
                    variant={schedule.isActive ? 'danger' : 'success'}
                    onClick={() => handleToggleActive(schedule._id, schedule.isActive)}
                  >
                    {schedule.isActive ? 'Деактивировать' : 'Активировать'}
                  </Button>
                </div>
              </div>

              {editScheduleId === schedule._id ? (
                <div className={classes.editMode}>
                  <div>
                    <div className={classes.sectionTitle}>
                      <FaClock /> Смены
                      <Button
                        variant="secondary"
                        icon={<FaPlus />}
                        onClick={handleAddShift}
                      >
                        Добавить смену
                      </Button>
                    </div>
                    <div className={classes.shiftsGrid}>
                      {Object.entries(editableSchedule.shifts).map(([day, shift]) => (
                        <div key={day} className={classes.shiftCard}>
                          <div className={classes.shiftCardHeader}>
                            <span className={classes.dayLabel}>{DAYS[day]}</span>
                            <Button
                              variant="ghost"
                              icon={<FaTrash />}
                              onClick={() => handleDeleteShift(day)}
                            />
                          </div>
                          <div className={classes.shiftCardBody}>
                            <input
                              type="time"
                              value={shift.startTime || ''}
                              onChange={(e) => handleShiftChange(day, 'startTime', e.target.value)}
                            />
                            <span className={classes.timeSeparator}>—</span>
                            <input
                              type="time"
                              value={shift.endTime || ''}
                              onChange={(e) => handleShiftChange(day, 'endTime', e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className={classes.sectionTitle}>Лимиты нагрузки</div>
                    <div className={classes.limits}>
                      <label>
                        <span>Макс. задач в день</span>
                        <input
                          type="number"
                          min="0"
                          value={editableSchedule.limits.maxDailyIssues}
                          onChange={(e) => handleLimitChange('maxDailyIssues', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Макс. активных задач</span>
                        <input
                          type="number"
                          min="0"
                          value={editableSchedule.limits.maxActiveIssues}
                          onChange={(e) => handleLimitChange('maxActiveIssues', e.target.value)}
                        />
                      </label>
                      <label>
                        <span>Предпочтительная загрузка (%)</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editableSchedule.limits.preferredLoadPercent}
                          onChange={(e) => handleLimitChange('preferredLoadPercent', e.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className={classes.editActions}>
                    <Button icon={<FaSave />} onClick={handleSaveSchedule}>
                      Сохранить
                    </Button>
                    <Button variant="secondary" icon={<FaTimes />} onClick={handleCancelEdit}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={classes.viewMode}>
                  <div className={classes.sectionTitle}><FaClock /> Рабочие смены</div>
                  <div className={classes.shiftsGrid}>
                    {Object.entries(schedule.shifts || {}).map(([day, shift]) => (
                      <div key={day} className={classes.shiftCard}>
                        <span className={classes.dayLabel}>{DAYS[day]}</span>
                        <span className={classes.timeRange}>
                          {shift.startTime} <span className={classes.timeSeparator}>—</span> {shift.endTime}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className={classes.sectionTitle}>Лимиты нагрузки</div>
                  <div className={classes.limitsView}>
                    <div className={classes.limitItem}>
                      <span>Макс. задач в день</span>
                      <strong>{schedule.limits?.maxDailyIssues || 0}</strong>
                    </div>
                    <div className={classes.limitItem}>
                      <span>Макс. активных задач</span>
                      <strong>{schedule.limits?.maxActiveIssues || 0}</strong>
                    </div>
                    <div className={classes.limitItem}>
                      <span>Загрузка</span>
                      <strong>{schedule.limits?.preferredLoadPercent || 0}%</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
        <CreateScheduleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default EmployeeSchedulePage;
