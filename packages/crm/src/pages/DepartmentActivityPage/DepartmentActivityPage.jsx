// packages/crm/src/pages/DepartmentActivityPage/DepartmentActivityPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { useNavigate } from 'react-router-dom';
import {
  FaChartLine,
  FaCalendarAlt,
  FaUsers,
  FaRedo,
  FaFilter,
  FaTimes,
  FaUser,
  FaClock,
  FaCode,
  FaExchangeAlt,
  FaChartBar
} from 'react-icons/fa';
import Select from '../../components/Select/Select';
import Button from '../../components/Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './DepartmentActivityPage.module.css';

const DepartmentActivityPage = () => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const [filters, setFilters] = useState({
    dateRange: 7, // дней назад
    eventType: 'all',
    authorAccountId: 'all',
    limit: 50,
    skip: 0
  });

  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null
  });

  // Опции для фильтров
  const dateRangeOptions = [
    { value: 1, label: 'Сегодня' },
    { value: 3, label: 'Последние 3 дня' },
    { value: 7, label: 'Последние 7 дней' },
    { value: 14, label: 'Последние 2 недели' },
    { value: 30, label: 'Последний месяц' }
  ];

  const eventTypeOptions = [
    { value: 'all', label: 'Все события' },
    { value: 'issue_assigned', label: 'Назначения' },
    { value: 'issue_created', label: 'Создания' },
    { value: 'issue_updated', label: 'Обновления' },
    { value: 'issue_generic', label: 'Общие изменения' }
  ];

  // Рассчитываем dateRange на основе фильтров
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - filters.dateRange);

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

      // Получаем активность департамента
      const activityResponse = await axios.get(
        URLS.GET_DEPARTMENT_ACTIVITY(selectedDepartment),
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate
          }
        }
      );

      setActivityData(activityResponse.data);

      // Получаем логи с фильтрами
      const searchParams = {
        departmentId: selectedDepartment,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: filters.limit,
        skip: filters.skip
      };

      if (filters.eventType !== 'all') {
        searchParams.eventType = filters.eventType;
      }

      if (filters.authorAccountId !== 'all') {
        searchParams.authorAccountId = filters.authorAccountId;
      }

      const logsResponse = await axios.get(
        URLS.SEARCH_CHANGELOGS,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: searchParams
        }
      );

      setLogs(logsResponse.data.data || []);
    } catch (error) {
      console.error('Ошибка загрузки активности:', error);
      notify.error('Не удалось загрузить данные об активности');
    } finally {
      hideLoader();
    }
  }, [selectedDepartment, dateRange, filters, showLoader, hideLoader, notify]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment && dateRange.startDate) {
      fetchActivityData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, dateRange.startDate, filters]);

  useEffect(() => {
    if (selectedDepartment && dateRange.startDate) {
      fetchActivityData();
    }
  }, [selectedDepartment, dateRange.startDate, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      skip: 0 // Сброс пагинации при изменении фильтра
    }));
  };

  const resetFilters = () => {
    setFilters({
      dateRange: 7,
      eventType: 'all',
      authorAccountId: 'all',
      limit: 50,
      skip: 0
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      weekday: 'short'
    });
  };

  const getEventTypeLabel = (eventType) => {
    const labels = {
      'issue_assigned': 'Назначение',
      'issue_created': 'Создание',
      'issue_updated': 'Обновление',
      'issue_generic': 'Изменение'
    };
    return labels[eventType] || eventType;
  };

  const getEventTypeColor = (eventType) => {
    const colors = {
      'issue_assigned': classes.eventAssigned,
      'issue_created': classes.eventCreated,
      'issue_updated': classes.eventUpdated,
      'issue_generic': classes.eventGeneric
    };
    return colors[eventType] || classes.eventDefault;
  };

  const departmentOptions = departments.map(d => ({
    value: d.jiraId,
    label: d.name
  }));

  // Опции авторов из топа сотрудников
  const authorOptions = [
    { value: 'all', label: 'Все сотрудники' },
    ...(activityData?.topEmployees?.map(emp => ({
      value: emp.authorAccountId,
      label: emp.displayName
    })) || [])
  ];


  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerInfo}>
          <h1><FaChartLine /> Активность отдела</h1>
          <p>Мониторинг действий сотрудников в реальном времени</p>
        </div>
        <div className={classes.headerControls}>
          <Select
            options={departmentOptions}
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            placeholder="Выберите отдел"
          />
          <Button
            variant="primary"
            icon={<FaClock />}
            onClick={() => navigate('/hourly-activity')}
          >
            График по часам
          </Button>
          <Button
            variant="secondary"
            icon={showFilters ? <FaTimes /> : <FaFilter />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Скрыть фильтры' : 'Фильтры'}
          </Button>
          <Button
            variant="secondary"
            icon={<FaRedo />}
            onClick={fetchActivityData}
          >
            Обновить
          </Button>
        </div>
      </header>

      {/* Панель фильтров */}
      {showFilters && (
        <div className={classes.filtersPanel}>
          <div className={classes.filterRow}>
            <div className={classes.filterGroup}>
              <label><FaCalendarAlt /> Период</label>
              <Select
                options={dateRangeOptions}
                value={filters.dateRange}
                onChange={(value) => handleFilterChange('dateRange', value)}
              />
            </div>

            <div className={classes.filterGroup}>
              <label><FaCode /> Тип события</label>
              <Select
                options={eventTypeOptions}
                value={filters.eventType}
                onChange={(value) => handleFilterChange('eventType', value)}
              />
            </div>

            <div className={classes.filterGroup}>
              <label><FaUser /> Сотрудник</label>
              <Select
                options={authorOptions}
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

      {activityData && (
        <>
          {/* Общая статистика отдела */}
          <div className={classes.statsGrid}>
            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaChartLine />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Всего событий</span>
                <span className={classes.statValue}>
                  {activityData.summary?.totalEvents || 0}
                </span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaUsers />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Активных сотрудников</span>
                <span className={classes.statValue}>
                  {activityData.summary?.uniqueAuthorsCount || 0}
                </span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaCode />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Обработано задач</span>
                <span className={classes.statValue}>
                  {activityData.summary?.uniqueIssuesCount || 0}
                </span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon}>
                <FaCalendarAlt />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Типов событий</span>
                <span className={classes.statValue}>
                  {activityData.summary?.eventTypesCount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Топ активных сотрудников */}
          {activityData.topEmployees && activityData.topEmployees.length > 0 && (
            <div className={classes.section}>
              <h2><FaUsers /> Топ активных сотрудников</h2>
              <div className={classes.topEmployees}>
                {activityData.topEmployees.slice(0, 5).map((employee, index) => (
                  <div key={employee.authorAccountId} className={classes.topEmployeeCard}>
                    <div className={classes.topRank}>#{index + 1}</div>
                    <div className={classes.topEmployeeInfo}>
                      <h3>{employee.displayName}</h3>
                      <span className={classes.topEmployeeStats}>
                        {employee.eventsCount} событий • {employee.uniqueIssuesCount} задач
                      </span>
                    </div>
                    <div className={classes.topEmployeeBadge}>
                      {employee.eventsCount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Активность по дням */}
          {activityData.dailyActivity && activityData.dailyActivity.length > 0 && (
            <div className={classes.section}>
              <h2><FaCalendarAlt /> Активность по дням</h2>
              <div className={classes.dailyChart}>
                {activityData.dailyActivity.map((day) => (
                  <div key={day.date} className={classes.dayColumn}>
                    <div
                      className={classes.dayBar}
                      style={{
                        height: `${Math.min((day.totalEvents / Math.max(...activityData.dailyActivity.map(d => d.totalEvents))) * 100, 100)}%`
                      }}
                    >
                      <span className={classes.dayValue}>{day.totalEvents}</span>
                    </div>
                    <div className={classes.dayLabel}>
                      {formatDateShort(day.date)}
                    </div>
                    <div className={classes.daySubLabel}>
                      {day.uniqueAuthorsCount} чел.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Логи действий */}
          <div className={classes.section}>
            <h2><FaClock /> Последние действия</h2>
            {logs.length > 0 ? (
              <div className={classes.logsGrid}>
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className={`${classes.logCard} ${getEventTypeColor(log.eventType)}`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className={classes.logHeader}>
                      <span className={`${classes.logBadge} ${getEventTypeColor(log.eventType)}`}>
                        {getEventTypeLabel(log.eventType)}
                      </span>
                      <span className={classes.logTime}>
                        <FaClock /> {formatDate(new Date(log.created).getTime())}
                      </span>
                    </div>

                    <div className={classes.logBody}>
                      <div className={classes.logIssue}>
                        <strong>{log.issueKey}</strong>
                      </div>

                      <div className={classes.logField}>
                        <span className={classes.fieldLabel}>Поле:</span>
                        <span className={classes.fieldValue}>{log.field}</span>
                      </div>

                      {log.field === 'assignee' && (
                        <div className={classes.logChange}>
                          <div className={classes.changeFrom}>
                            {log.fromString || 'Не назначено'}
                          </div>
                          <div className={classes.changeArrow}>
                            <FaExchangeAlt />
                          </div>
                          <div className={classes.changeTo}>
                            {log.toString || 'Не назначено'}
                          </div>
                        </div>
                      )}

                      {log.field === 'status' && (
                        <div className={classes.logChange}>
                          <div className={classes.changeFrom}>
                            {log.fromString || 'Новый'}
                          </div>
                          <div className={classes.changeArrow}>
                            <FaExchangeAlt />
                          </div>
                          <div className={classes.changeTo}>
                            {log.toString}
                          </div>
                        </div>
                      )}

                      {log.field !== 'assignee' && log.field !== 'status' && log.toString && (
                        <div className={classes.logValue}>
                          {log.toString}
                        </div>
                      )}
                    </div>

                    <div className={classes.logFooter}>
                      <div className={classes.logAuthor}>
                        <FaUser />
                        <span>{log.authorDisplayName}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={classes.empty}>
                <FaClock size={64} />
                <h3>Нет логов</h3>
                <p>За выбранный период не найдено действий</p>
              </div>
            )}
          </div>

          {/* Модальное окно с деталями лога */}
          {selectedLog && (
            <div className={classes.modal} onClick={() => setSelectedLog(null)}>
              <div className={classes.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={classes.modalHeader}>
                  <h2>Детали события</h2>
                  <button
                    className={classes.modalClose}
                    onClick={() => setSelectedLog(null)}
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className={classes.modalBody}>
                  <div className={classes.detailRow}>
                    <span className={classes.detailLabel}>Задача:</span>
                    <span className={classes.detailValue}>
                      <strong>{selectedLog.issueKey}</strong> (ID: {selectedLog.issueId})
                    </span>
                  </div>

                  <div className={classes.detailRow}>
                    <span className={classes.detailLabel}>Тип события:</span>
                    <span className={`${classes.detailBadge} ${getEventTypeColor(selectedLog.eventType)}`}>
                      {getEventTypeLabel(selectedLog.eventType)}
                    </span>
                  </div>

                  <div className={classes.detailRow}>
                    <span className={classes.detailLabel}>Поле:</span>
                    <span className={classes.detailValue}>{selectedLog.field}</span>
                  </div>

                  <div className={classes.detailRow}>
                    <span className={classes.detailLabel}>Автор:</span>
                    <span className={classes.detailValue}>
                      {selectedLog.authorDisplayName}
                      {selectedLog.authorEmail && ` (${selectedLog.authorEmail})`}
                    </span>
                  </div>

                  <div className={classes.detailRow}>
                    <span className={classes.detailLabel}>Время:</span>
                    <span className={classes.detailValue}>
                      {formatDate(new Date(selectedLog.created).getTime())}
                    </span>
                  </div>

                  {selectedLog.fromString && (
                    <div className={classes.detailRow}>
                      <span className={classes.detailLabel}>Было:</span>
                      <span className={classes.detailValue}>{selectedLog.fromString}</span>
                    </div>
                  )}

                  {selectedLog.toString && (
                    <div className={classes.detailRow}>
                      <span className={classes.detailLabel}>Стало:</span>
                      <span className={classes.detailValue}>{selectedLog.toString}</span>
                    </div>
                  )}

                  <div className={classes.detailRow}>
                    <span className={classes.detailLabel}>History ID:</span>
                    <span className={classes.detailValue}>{selectedLog.historyId}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DepartmentActivityPage;
