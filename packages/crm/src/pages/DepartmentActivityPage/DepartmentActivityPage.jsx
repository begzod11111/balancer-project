// packages/crm/src/pages/DepartmentActivityPage/DepartmentActivityPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import {
  FaChartLine,
  FaCalendarAlt,
  FaUsers,
  FaRedo,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';
import Select from '../../components/Select/Select';
import Button from '../../components/Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './DepartmentActivityPage.module.css';

const DepartmentActivityPage = () => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();

  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null
  });

  // Получаем последние 7 дней
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6); // последние 7 дней включая сегодня

    setDateRange({
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_ACTIVE_DEPARTMENTS, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const depts = response.data.data || [];
      setDepartments(depts);
      if (depts.length > 0) {
        setSelectedDepartment(depts[0].jiraId);
      }
    } catch (error) {
      console.error('Ошибка загрузки отделов:', error);
      notify.error('Не удалось загрузить отделы');
    }
  }, [notify]);

  const fetchActivityData = useCallback(async () => {
    if (!selectedDepartment || !dateRange.startDate || !dateRange.endDate) return;

    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(
        URLS.GET_DEPARTMENT_ACTIVITY(selectedDepartment),
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          }
        }
      );

      setActivityData(response.data.data);
    } catch (error) {
      console.error('Ошибка загрузки активности:', error);
      notify.error('Не удалось загрузить данные об активности');
    } finally {
      hideLoader();
    }
  }, [selectedDepartment, dateRange, showLoader, hideLoader, notify]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment && dateRange.startDate) {
      fetchActivityData();
    }
  }, [selectedDepartment, dateRange.startDate]);

  const toggleEmployeeExpand = (accountId) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [accountId]: !prev[accountId]
    }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { day: '2-digit', month: '2-digit', weekday: 'short' };
    return date.toLocaleDateString('ru-RU', options);
  };

  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const getActivityForDay = (activities, day) => {
    if (!activities) return { count: 0, types: {} };
    const activity = activities.find(a => {
      const activityDate = new Date(a.date).toISOString().split('T')[0];
      return activityDate === day;
    });
    return activity || { count: 0, types: {} };
  };

  const getActivityColor = (count) => {
    if (count === 0) return classes.activityNone;
    if (count <= 5) return classes.activityLow;
    if (count <= 15) return classes.activityMedium;
    if (count <= 30) return classes.activityHigh;
    return classes.activityVeryHigh;
  };

  const departmentOptions = departments.map(d => ({
    value: d._id,
    label: d.name
  }));

  const last7Days = getLast7Days();

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h1><FaChartLine /> Активность отдела</h1>
          <p>Статистика действий сотрудников за последние 7 дней</p>
        </div>
        <div className={classes.controls}>
          <Select
            options={departmentOptions}
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            placeholder="Выберите отдел"
          />
          <Button
            variant="secondary"
            icon={<FaRedo />}
            onClick={fetchActivityData}
          >
            Обновить
          </Button>
        </div>
      </header>

      {activityData && (
        <>
          {/* Общая статистика отдела */}
          <div className={classes.departmentSummary}>
            <div className={classes.summaryCard}>
              <FaUsers className={classes.icon} />
              <div>
                <span className={classes.label}>Всего сотрудников</span>
                <span className={classes.value}>
                  {activityData.employeeActivities?.length || 0}
                </span>
              </div>
            </div>
            <div className={classes.summaryCard}>
              <FaChartLine className={classes.icon} />
              <div>
                <span className={classes.label}>Всего действий</span>
                <span className={classes.value}>
                  {activityData.totalActions || 0}
                </span>
              </div>
            </div>
            <div className={classes.summaryCard}>
              <FaCalendarAlt className={classes.icon} />
              <div>
                <span className={classes.label}>Средняя активность в день</span>
                <span className={classes.value}>
                  {activityData.averagePerDay?.toFixed(1) || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Сводная таблица по дням */}
          <div className={classes.section}>
            <h2>Активность отдела по дням</h2>
            <div className={classes.departmentGrid}>
              <div className={classes.gridHeader}>
                <div className={classes.headerCell}>День недели</div>
                {last7Days.map(day => (
                  <div key={day} className={classes.headerCell}>
                    {formatDate(day)}
                  </div>
                ))}
                <div className={classes.headerCell}>Итого</div>
              </div>
              <div className={classes.gridRow}>
                <div className={classes.rowLabel}>Действий</div>
                {last7Days.map(day => {
                  const activity = getActivityForDay(activityData.dailyActivity, day);
                  return (
                    <div
                      key={day}
                      className={`${classes.cell} ${getActivityColor(activity.count)}`}
                    >
                      {activity.count}
                    </div>
                  );
                })}
                <div className={classes.cellTotal}>
                  {activityData.totalActions || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Детальная активность по сотрудникам */}
          <div className={classes.section}>
            <h2>Активность сотрудников</h2>
            <div className={classes.employeeList}>
              {activityData.employeeActivities?.map((employee) => {
                const isExpanded = expandedEmployees[employee.accountId];
                const totalActions = employee.activities?.reduce(
                  (sum, act) => sum + act.count,
                  0
                ) || 0;

                return (
                  <div key={employee.accountId} className={classes.employeeCard}>
                    <div
                      className={classes.employeeHeader}
                      onClick={() => toggleEmployeeExpand(employee.accountId)}
                    >
                      <div className={classes.employeeInfo}>
                        <h3>{employee.displayName || 'Неизвестный сотрудник'}</h3>
                        <span className={classes.employeeEmail}>
                          {employee.email || employee.accountId}
                        </span>
                      </div>
                      <div className={classes.employeeStats}>
                        <span className={classes.totalActions}>
                          Всего: {totalActions}
                        </span>
                        {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={classes.employeeDetails}>
                        <div className={classes.activityGrid}>
                          <div className={classes.gridHeader}>
                            <div className={classes.headerCell}>Тип события</div>
                            {last7Days.map(day => (
                              <div key={day} className={classes.headerCell}>
                                {formatDate(day)}
                              </div>
                            ))}
                            <div className={classes.headerCell}>Итого</div>
                          </div>

                          {/* Группировка по типам событий */}
                          {employee.eventTypeSummary?.map((eventType) => (
                            <div key={eventType.type} className={classes.gridRow}>
                              <div className={classes.rowLabel}>
                                {eventType.type}
                              </div>
                              {last7Days.map(day => {
                                const activity = getActivityForDay(employee.activities, day);
                                const count = activity.types?.[eventType.type] || 0;
                                return (
                                  <div
                                    key={day}
                                    className={`${classes.cell} ${getActivityColor(count)}`}
                                  >
                                    {count > 0 ? count : '-'}
                                  </div>
                                );
                              })}
                              <div className={classes.cellTotal}>
                                {eventType.count}
                              </div>
                            </div>
                          ))}

                          {/* Итоговая строка */}
                          <div className={`${classes.gridRow} ${classes.totalRow}`}>
                            <div className={classes.rowLabel}>Всего</div>
                            {last7Days.map(day => {
                              const activity = getActivityForDay(employee.activities, day);
                              return (
                                <div
                                  key={day}
                                  className={`${classes.cellTotal} ${getActivityColor(activity.count)}`}
                                >
                                  {activity.count > 0 ? activity.count : '-'}
                                </div>
                              );
                            })}
                            <div className={classes.cellTotal}>
                              {totalActions}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(!activityData.employeeActivities || activityData.employeeActivities.length === 0) && (
                <div className={classes.empty}>
                  <FaUsers size={64} />
                  <h3>Нет данных об активности</h3>
                  <p>За выбранный период не найдено действий сотрудников</p>
                </div>
              )}
            </div>
          </div>

          {/* Легенда */}
          <div className={classes.legend}>
            <h3>Уровень активности:</h3>
            <div className={classes.legendItems}>
              <div className={classes.legendItem}>
                <div className={`${classes.legendBox} ${classes.activityNone}`}></div>
                <span>Нет активности (0)</span>
              </div>
              <div className={classes.legendItem}>
                <div className={`${classes.legendBox} ${classes.activityLow}`}></div>
                <span>Низкая (1-5)</span>
              </div>
              <div className={classes.legendItem}>
                <div className={`${classes.legendBox} ${classes.activityMedium}`}></div>
                <span>Средняя (6-15)</span>
              </div>
              <div className={classes.legendItem}>
                <div className={`${classes.legendBox} ${classes.activityHigh}`}></div>
                <span>Высокая (16-30)</span>
              </div>
              <div className={classes.legendItem}>
                <div className={`${classes.legendBox} ${classes.activityVeryHigh}`}></div>
                <span>Очень высокая (30+)</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DepartmentActivityPage;
