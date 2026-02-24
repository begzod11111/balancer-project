import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import {
  FaClock,
  FaCalendarAlt,
  FaUsers,
  FaRedo,
  FaFilter,
  FaTimes,
  FaChartBar,
  FaArrowLeft
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import Select from '../../components/Select/Select';
import Button from '../../components/Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './HourlyActivityPage.module.css';

const HourlyActivityPage = () => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    dateRange: 7,
    eventType: 'all',
    authorAccountId: 'all'
  });

  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null
  });

  const dateRangeOptions = [
    { value: 7, label: 'Последние 7 дней' },
    { value: 14, label: 'Последние 14 дней' },
    { value: 30, label: 'Последние 30 дней' }
  ];

  const eventTypeOptions = [
    { value: 'all', label: 'Все события' },
    { value: 'issue_assigned', label: 'Назначения' },
    { value: 'issue_created', label: 'Создания' },
    { value: 'issue_updated', label: 'Обновления' },
    { value: 'issue_generic', label: 'Общие изменения' }
  ];

  useEffect(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - filters.dateRange);
    start.setHours(0, 0, 0, 0);

    setDateRange({
      startDate: start.getTime(),
      endDate: end.getTime()
    });
  }, [filters.dateRange]);

  const fetchDepartments = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_ACTIVE_DEPARTMENTS, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const depts = response.data.data || [];
      setDepartments([
          { jiraId: 'all', name: 'Все отделы' },
          ...depts
      ]);
      if (depts.length > 0) {
        setSelectedDepartment(depts[0].jiraId);
      }
    } catch (error) {
      console.error('Ошибка загрузки отделов:', error);
      notify.error('Не удалось загрузить отделы');
    }
  }, [notify]);

  const fetchEmployees = useCallback(async () => {
    if (!selectedDepartment) return;

    try {
      const token = localStorage.getItem('accessToken');
      const departmentId = departments.find((d) => d.jiraId === selectedDepartment)?._id;
      const response = await axios.get(
        URLS.GET_WORK_SCHEDULE_BY_DEPARTMENT_ID(departmentId),
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const schedules = response.data || [];

      const uniqueEmployees = schedules
        .filter(s => s.accountId && s.assigneeName)
        .map(s => ({
          accountId: s.accountId,
          name: s.assigneeName,
          email: s.assigneeEmail
        }));

      setEmployees(uniqueEmployees);
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
    }
  }, [selectedDepartment, departments]);

  const fetchDailyData = useCallback(async () => {
  if (!selectedDepartment || !dateRange.startDate || !dateRange.endDate) return;

  showLoader();
  try {
    const token = localStorage.getItem('accessToken');

    const searchParams = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      limit: 10000
    };

    // Исправляем проверку - selectedDepartment это строка (jiraId)
    if (selectedDepartment !== 'all') {
      searchParams.departmentId = selectedDepartment;
    }

    if (filters.eventType !== 'all') {
      searchParams.eventType = filters.eventType;
    }

    if (filters.authorAccountId !== 'all') {
      searchParams.authorAccountId = filters.authorAccountId;
    }

    const response = await axios.get(
      URLS.SEARCH_CHANGELOGS,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: searchParams
      }
    );

    const logs = response.data.data || [];

    const dayMap = new Map();

    logs.forEach(log => {
      const date = new Date(log.created);
      const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          date: dayKey,
          count: 0,
          events: {}
        });
      }

      const dayData = dayMap.get(dayKey);
      dayData.count++;

      if (!dayData.events[log.eventType]) {
        dayData.events[log.eventType] = 0;
      }
      dayData.events[log.eventType]++;
    });

    const dailyStats = Array.from(dayMap.values()).sort((a, b) => b.date - a.date);
    setDailyData(dailyStats);
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    notify.error('Не удалось загрузить данные по дням');
  } finally {
    hideLoader();
  }
}, [selectedDepartment, dateRange, filters, showLoader, hideLoader, notify]);

  const fetchHourlyDataForDay = useCallback(async (dayTimestamp) => {
  if (!selectedDepartment) return;

  showLoader();
  try {
    const token = localStorage.getItem('accessToken');
    const dayStart = new Date(dayTimestamp);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayTimestamp);
    dayEnd.setHours(23, 59, 59, 999);

    const searchParams = {
      startDate: dayStart.getTime(),
      endDate: dayEnd.getTime(),
      limit: 10000
    };

    // Исправляем проверку
    if (selectedDepartment !== 'all') {
      searchParams.departmentId = selectedDepartment;
    }

    if (filters.eventType !== 'all') {
      searchParams.eventType = filters.eventType;
    }

    if (filters.authorAccountId !== 'all') {
      searchParams.authorAccountId = filters.authorAccountId;
    }

    const response = await axios.get(
      URLS.SEARCH_CHANGELOGS,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: searchParams
      }
    );

    const logs = response.data.data || [];

    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      events: {}
    }));

    logs.forEach(log => {
      const date = new Date(log.created);
      const hour = date.getHours();

      hourlyStats[hour].count++;

      if (!hourlyStats[hour].events[log.eventType]) {
        hourlyStats[hour].events[log.eventType] = 0;
      }
      hourlyStats[hour].events[log.eventType]++;
    });

    setHourlyData(hourlyStats);
    setSelectedDate(dayTimestamp);
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    notify.error('Не удалось загрузить почасовые данные');
  } finally {
    hideLoader();
  }
}, [selectedDepartment, filters, showLoader, hideLoader, notify]);

  useEffect(() => {
    fetchDepartments();}, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchEmployees();
    }
  }, [selectedDepartment]);

  useEffect(() => {
    if (selectedDepartment && dateRange.startDate) {
      fetchDailyData();
      setSelectedDate(null);
      setHourlyData([]);
    }
  }, [selectedDepartment, dateRange.startDate, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      dateRange: 7,
      eventType: 'all',
      authorAccountId: 'all'
    });
  };

  const handleDayClick = (dayTimestamp) => {
    fetchHourlyDataForDay(dayTimestamp);
  };

  const handleBackToDays = () => {
    setSelectedDate(null);
    setHourlyData([]);
  };

  const getEventTypeColor = (eventType) => {
    const colors = {
      'issue_assigned': '#3b82f6',
      'issue_created': '#10b981',
      'issue_updated': '#f59e0b',
      'issue_generic': '#8b5cf6'
    };
    return colors[eventType] || '#6b7280';
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  const formatFullDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const departmentOptions = departments.map(d => ({
    value: d.jiraId,
    label: d.name
  }));

  const totalEvents = selectedDate
    ? hourlyData.reduce((sum, h) => sum + h.count, 0)
    : dailyData.reduce((sum, d) => sum + d.count, 0);

  const maxCount = selectedDate
    ? Math.max(...hourlyData.map(h => h.count), 1)
    : Math.max(...dailyData.map(d => d.count), 1);

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerInfo}>
          <Button
            variant="secondary"
            icon={<FaArrowLeft />}
            onClick={() => navigate('/department-activity')}
          >
            Назад
          </Button>
          <div>
            <h1><FaClock /> {selectedDate ? 'Активность по часам' : 'Активность по дням'}
            </h1>
            <p>
              {selectedDate
                ? `Анализ за ${formatFullDate(selectedDate)}`
                : 'Выберите день для детального просмотра'
              }
            </p>
          </div>
        </div>
        <div className={classes.headerControls}>
          <Select
            options={departmentOptions}
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            placeholder="Выберите отдел"
          />
          <Button
            variant="secondary"
            icon={showFilters ? <FaTimes /> : <FaFilter />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Скрыть' : 'Фильтры'}
          </Button>
          <Button
            variant="secondary"
            icon={<FaRedo />}
            onClick={selectedDate ? () => fetchHourlyDataForDay(selectedDate) : fetchDailyData}
          >Обновить
          </Button>
        </div>
      </header>

      {showFilters && (
        <div className={classes.filtersPanel}>
          <div className={classes.filterRow}>
            {!selectedDate && (
              <div className={classes.filterGroup}>
                <label><FaCalendarAlt /> Период</label>
                <Select
                  options={dateRangeOptions}
                  value={filters.dateRange}
                  onChange={(value) => handleFilterChange('dateRange', value)}
                />
              </div>
            )}

            <div className={classes.filterGroup}>
              <label><FaChartBar /> Тип события</label>
              <Select
                options={eventTypeOptions}
                value={filters.eventType}
                onChange={(value) => handleFilterChange('eventType', value)}
              />
            </div>

            <div className={classes.filterGroup}>
              <label><FaUsers /> Сотрудник</label>
              <Select
                options={[
                  { value: 'all', label: 'Все сотрудники' },
                  ...employees.map(emp => ({
                    value: emp.accountId,
                    label: emp.name
                  }))
                ]}
                value={filters.authorAccountId}
                onChange={(value) => handleFilterChange('authorAccountId', value)}
              />
            </div>

            <div className={classes.filterActions}>
              <Button
                variant="secondary"
                icon={<FaTimes />}
                onClick={resetFilters}
              >
                Сбросить
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedDate && (
        <div className={classes.breadcrumbs}>
          <Button
            variant="link"
            icon={<FaArrowLeft />}
            onClick={handleBackToDays}
          >
            Вернуться к дням
          </Button></div>
      )}

      <div className={classes.statsGrid}>
        <div className={classes.statCard}>
          <div className={classes.statIcon}>
            <FaChartBar />
          </div>
          <div className={classes.statContent}>
            <span className={classes.statLabel}>Всего событий</span>
            <span className={classes.statValue}>{totalEvents}</span>
          </div>
        </div>

        {!selectedDate ? (
          <>
            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaCalendarAlt />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Самый активный день</span>
                <span className={classes.statValue}>
                  {dailyData.length > 0
                    ? formatDate(dailyData.reduce((max, d) => d.count > max.count ? d : max, dailyData[0]).date)
                    : '-'
                  }
                </span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaUsers />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Средняя нагрузка</span>
                <span className={classes.statValue}>
                  {dailyData.length > 0 ? (totalEvents / dailyData.length).toFixed(1) : 0} / день
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaClock />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Самый активный час</span>
                <span className={classes.statValue}>
                  {hourlyData.reduce((max, h) => h.count > max.count ? h : max, { hour: 0, count: 0 }).hour}:00
                </span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaUsers />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Средняя нагрузка</span>
                <span className={classes.statValue}>
                  {(totalEvents / 24).toFixed(1)} / час
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {!selectedDate ? (
        // График по дням
        <div className={classes.section}>
          <h2><FaCalendarAlt /> Активность по дням</h2>
          <div className={classes.chartContainer}>
            <div className={classes.dailyChart}>
              {dailyData.map((dayData) => {
                const heightPercent = (dayData.count / maxCount) * 100;

                return (
                  <div
                    key={dayData.date}
                    className={classes.dayColumn}
                    onClick={() => handleDayClick(dayData.date)}
                  >
                    <div className={classes.barContainer}>
                      <div
                        className={classes.dayBar}
                        style={{ height: `${Math.max(heightPercent, 5)}%` }}
                      >
                        {Object.entries(dayData.events).map(([eventType, count]) => {
                          const segmentHeight = (count / dayData.count) * 100;
                          return (
                            <div
                              key={eventType}
                              className={classes.barSegment}
                              style={{
                                height: `${segmentHeight}%`,
                                backgroundColor: getEventTypeColor(eventType)
                              }}
                              title={`${eventType}: ${count}`}
                            />
                          );
                        })}

                        {dayData.count > 0 && (
                          <span className={classes.barValue}>{dayData.count}</span>
                        )}
                      </div>
                    </div>

                    <div className={classes.dayLabel}>
                      {formatDate(dayData.date)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // График по часам
        <div className={classes.section}>
          <h2><FaClock /> Распределение по часам</h2>
          <div className={classes.chartContainer}>
            <div className={classes.hourlyChart}>
              {hourlyData.map((hourData) => {
                const heightPercent = (hourData.count / maxCount) * 100;

                return (
                  <div key={hourData.hour} className={classes.hourColumn}>
                    <div className={classes.barContainer}>
                      <div
                        className={classes.hourBar}
                        style={{ height: `${Math.max(heightPercent, 5)}%` }}
                      >
                        {Object.entries(hourData.events).map(([eventType, count]) => {
                          const segmentHeight = (count / hourData.count) * 100;
                          return (
                            <div
                              key={eventType}
                              className={classes.barSegment}
                              style={{
                                height: `${segmentHeight}%`,
                                backgroundColor: getEventTypeColor(eventType)
                              }}
                              title={`${eventType}: ${count}`}
                            />
                          );
                        })}

                        {hourData.count > 0 && (
                          <span className={classes.barValue}>{hourData.count}</span>
                        )}
                      </div>
                    </div>

                    <div className={classes.hourLabel}>
                      {String(hourData.hour).padStart(2, '0')}:00
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}<div className={classes.legend}>
        <h3>Типы событий:</h3>
        <div className={classes.legendItems}>
          <div className={classes.legendItem}>
            <div className={classes.legendBox} style={{ backgroundColor: '#3b82f6' }}></div>
            <span>Назначения</span>
          </div>
          <div className={classes.legendItem}>
            <div className={classes.legendBox} style={{ backgroundColor: '#10b981' }}></div>
            <span>Создания</span>
          </div>
          <div className={classes.legendItem}>
            <div className={classes.legendBox} style={{ backgroundColor: '#f59e0b' }}></div>
            <span>Обновления</span>
          </div>
          <div className={classes.legendItem}>
            <div className={classes.legendBox} style={{ backgroundColor: '#8b5cf6' }}></div>
            <span>Изменения</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HourlyActivityPage;

