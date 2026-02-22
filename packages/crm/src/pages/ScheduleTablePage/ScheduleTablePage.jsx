// packages/crm/src/pages/ScheduleTablePage/ScheduleTablePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaClock, FaFilter, FaRedo, FaCheck, FaTimes, FaEdit } from 'react-icons/fa';
import Select from '../../components/Select/Select';
import Button from '../../components/Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './ScheduleTablePage.module.css';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const FULL_DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const ScheduleTablePage = () => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();

  const [schedules, setSchedules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    isActive: null,
    deleted: false,
    departmentId: null,
    assigneeEmail: '',
    sort: 'assigneeName'
  });

  const fetchDepartments = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_DEPARTMENTS, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const depts = response.data.data.map(dept => ({
        value: dept._id,
        label: dept.name
      }));
      setDepartments(depts);
    } catch (error) {
      console.error('Ошибка загрузки отделов:', error);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const params = {};

      if (filters.isActive !== null) params.isActive = filters.isActive;
      if (filters.deleted) params.deleted = filters.deleted;
      if (filters.departmentId) params.departmentId = filters.departmentId;
      if (filters.assigneeEmail) params.assigneeEmail = filters.assigneeEmail;
      if (filters.sort) params.sort = filters.sort;
      params.limit = 1000;

      const response = await axios.get(URLS.GET_WORK_SCHEDULES, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setSchedules(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      notify.error('Не удалось загрузить расписания');
    } finally {
      hideLoader();
    }
  }, [filters, showLoader, hideLoader, notify]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleApplyFilters = () => {
    fetchSchedules();
  };

  const handleReset = () => {
    setFilters({
      isActive: null,
      deleted: false,
      departmentId: null,
      assigneeEmail: '',
      sort: 'assigneeName'
    });
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.value === deptId);
    return dept?.label || 'Неизвестно';
  };

  const getShiftForDay = (shifts, dayIndex) => {
    const shift = shifts?.[dayIndex];
    if (!shift) return null;
    return `${shift.startTime || '—'} - ${shift.endTime || '—'}`;
  };

  const statusOptions = [
    { value: null, label: 'Все статусы' },
    { value: true, label: 'Только активные' },
    { value: false, label: 'Только неактивные' }
  ];

  const sortOptions = [
    { value: 'assigneeName', label: 'По имени сотрудника' },
    { value: 'department', label: 'По отделу' },
    { value: 'updatedAt', label: 'По дате обновления' }
  ];

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h1><FaClock /> Расписание сотрудников</h1>
          <p>Табличное представление рабочих смен</p>
        </div>
      </header>

      <div className={classes.filterPanel}>
        <div className={classes.filterHeader}>
          <h3>Фильтры</h3>
          <Button
            variant="secondary"
            icon={<FaFilter />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Скрыть' : 'Показать'}
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

              <label className={classes.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={filters.deleted}
                  onChange={(e) => setFilters(prev => ({ ...prev, deleted: e.target.checked }))}
                />
                Показать удалённые
              </label>
            </div>

            <div className={classes.filterActions}>
              <Button onClick={handleApplyFilters} icon={<FaCheck />}>
                Применить
              </Button>
              <Button variant="secondary" onClick={handleReset} icon={<FaRedo />}>
                Сбросить
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={classes.tableContainer}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.stickyCol}>Сотрудник</th>
              <th>Отдел</th>
              <th>Статус</th>
              {DAYS.map((day, index) => (
                <th key={index} className={classes.dayHeader} title={FULL_DAYS[index]}>
                  {day}
                </th>
              ))}<th>Лимиты</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={11} className={classes.empty}>
                  <FaClock size={32} />
                  <p>Расписания не найдены</p>
                </td>
              </tr>
            ) : (
              schedules.map(schedule => (
                <tr key={schedule._id} className={schedule.isActive ? '' : classes.inactive}>
                  <td className={classes.stickyCol}>
                    <div className={classes.employeeInfo}>
                      <strong>{schedule.assigneeName}</strong>
                      <span>{schedule.assigneeEmail}</span>
                    </div>
                  </td>
                  <td className={classes.deptCell}>
                    {getDepartmentName(schedule.department)}
                  </td>
                  <td>
                    <span className={`${classes.badge} ${schedule.isActive ? classes.active : classes.inactive}`}>
                      {schedule.isActive ? <><FaCheck /> Активен</> : <><FaTimes /> Неактивен</>}
                    </span>
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
                    const shift = getShiftForDay(schedule.shifts, dayIndex);
                    return (
                      <td key={dayIndex} className={classes.shiftCell}>
                        {shift ? (
                          <div className={classes.shiftTime}>{shift}</div>
                        ) : (
                          <span className={classes.noShift}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={classes.limitsCell}>
                    <div className={classes.limits}>
                      <div>Макс/день: <strong>{schedule.limits?.maxDailyIssues || 0}</strong></div>
                      <div>Активных: <strong>{schedule.limits?.maxActiveIssues || 0}</strong></div>
                      <div>Загрузка: <strong>{schedule.limits?.preferredLoadPercent || 0}%</strong></div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleTablePage;
