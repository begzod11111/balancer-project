import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import {
  FaUsers,
  FaRedo,
  FaUser,
  FaClock,
  FaComments,
  FaCalendarAlt,
  FaTrophy,
  FaChartLine,
  FaExchangeAlt,
  FaTasks,
  FaFileExport,
  FaCode,
  FaChartBar,
  FaChartPie,
  FaCheckSquare,
  FaSquare
} from 'react-icons/fa';
import Select from '../../components/Select/Select';
import Button from '../../components/Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './EmployeeActivityAnalyticsPage.module.css';

const EmployeeActivityAnalyticsPage = () => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();

  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [showEmployeeSelector, setShowEmployeeSelector] = useState(false);

  const [filters, setFilters] = useState({
    dateRange: 7
  });

  const dateRangeOptions = [
    { value: 1, label: 'Сегодня' },
    { value: 3, label: 'Последние 3 дня' },
    { value: 7, label: 'Последние 7 дней' },
    { value: 14, label: 'Последние 2 недели' },
    { value: 30, label: 'Последний месяц' }
  ];

  const fetchDepartments = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_ACTIVE_DEPARTMENTS, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const depts = response.data.data || [];
      setDepartments(depts);
      if (depts.length > 0) {
        setSelectedDepartment(depts[0]._id);
      }
    } catch (error) {
      console.error('Ошибка загрузки отделов:', error);
      notify.error('Не удалось загрузить отделы');
    }
  }, [notify]);

  const fetchEmployees = useCallback(async (departmentId) => {
    if (!departmentId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_WORK_SCHEDULE_BY_DEPARTMENT_ID(departmentId), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const emps = response.data || [];
      setEmployees(emps);
      const accountIds = emps.map(emp => emp.accountId);
      setSelectedEmployees(accountIds);
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
      notify.error('Не удалось загрузить сотрудников');
    }
  }, [notify]);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedEmployees || selectedEmployees.length === 0) {
      notify.warning('Выберите хотя бы одного сотрудника');
      return;
    }

    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - filters.dateRange);

      const response = await axios.post(
        URLS.GET_ACTIVITY_ANALYTICS,
        {
          accountIds: selectedEmployees,
          startTimestamp: Math.floor(start.getTime()),
          endTimestamp: Math.floor(end.getTime())
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setAnalyticsData(response.data.data);
        notify.success('Данные загружены');
      }
    } catch (error) {
      console.error('Ошибка загрузки аналитики:', error);
      notify.error('Не удалось загрузить аналитику');
    } finally {
      hideLoader();
    }
  }, [selectedEmployees, filters.dateRange, showLoader, hideLoader, notify]);

  const handleExportCSV = async () => {
    if (!selectedEmployees || selectedEmployees.length === 0) {
      notify.warning('Выберите сотрудников для экспорта');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - filters.dateRange);

      const response = await axios.post(
        URLS.EXPORT_ACTIVITY_ANALYTICS_CSV,
        {
          accountIds: selectedEmployees,
          startTimestamp: Math.floor(start.getTime()),
          endTimestamp: Math.floor(end.getTime())
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity-stats-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      notify.success('Экспорт выполнен');
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      notify.error('Не удалось экспортировать');
    }
  };

  const handleToggleEmployee = (accountId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  const handleSelectAll = () => {
    const allIds = employees.map(emp => emp.accountId);
    setSelectedEmployees(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedEmployees([]);
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchEmployees(selectedDepartment);
    }
  }, [selectedDepartment]);

  const departmentOptions = departments.map(d => ({
    value: d._id,
    label: d.name
  }));

  const getEmployeeName = (accountId) => {
    const emp = employees.find(e => e.accountId === accountId);
    return emp?.assigneeName || accountId.slice(0, 15);
  };

  const getEmployeeEmail = (accountId) => {
    const emp = employees.find(e => e.accountId === accountId);
    return emp?.assigneeEmail || '';
  };

  const getTopEmployees = () => {
    if (!analyticsData?.employees) return [];
    return [...analyticsData.employees]
      .sort((a, b) => b.totalActions - a.totalActions)
      .slice(0, 5);
  };

  const topEmployees = getTopEmployees();

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div className={classes.headerInfo}>
          <h1><FaChartLine /> Аналитика активности сотрудников</h1>
          <p>Детальная статистика по работе сотрудников отдела</p>
        </div>
        <div className={classes.headerControls}>
          <Select
            options={departmentOptions}
            value={selectedDepartment}
            onChange={setSelectedDepartment}
            placeholder="Выберите отдел"
          />
          <Select
            options={dateRangeOptions}
            value={filters.dateRange}
            onChange={(value) => setFilters(prev => ({ ...prev, dateRange: value }))}
          />
          <Button
            variant="secondary"
            icon={<FaUsers />}
            onClick={() => setShowEmployeeSelector(!showEmployeeSelector)}
          >Выбор сотрудников ({selectedEmployees.length})
          </Button>
          <Button variant="secondary" icon={<FaRedo />} onClick={fetchAnalytics}>
            Применить и загрузить
          </Button>
          <Button variant="primary" icon={<FaFileExport />} onClick={handleExportCSV}>
            Экспорт CSV
          </Button>
        </div>
      </header>

      {/* Панель выбора сотрудников */}
      {showEmployeeSelector && (
        <div className={classes.employeeSelector}>
          <div className={classes.selectorHeader}>
            <h3><FaUsers /> Выберите сотрудников для анализа</h3>
            <div className={classes.selectorActions}>
              <Button variant="secondary" size="small" onClick={handleSelectAll}>
                Выбрать всех
              </Button>
              <Button variant="secondary" size="small" onClick={handleDeselectAll}>
                Снять всё
              </Button>
            </div>
          </div>
          <div className={classes.employeeList}>
            {employees.map(emp => (
              <div
                key={emp.accountId}
                className={`${classes.employeeItem} ${selectedEmployees.includes(emp.accountId) ? classes.selected : ''}`}
                onClick={() => handleToggleEmployee(emp.accountId)}
              >
                <div className={classes.checkbox}>
                  {selectedEmployees.includes(emp.accountId) ? (
                    <FaCheckSquare color="#667eea" size={20} />
                  ) : (
                    <FaSquare color="#cbd5e0" size={20} />
                  )}
                </div>
                <div className={classes.employeeItemAvatar}>
                  <FaUser />
                </div>
                <div className={classes.employeeItemInfo}>
                  <span className={classes.employeeItemName}>{emp.assigneeName}</span>
                  <span className={classes.employeeItemEmail}>{emp.assigneeEmail}</span>
                </div>
              </div>
            ))}
          </div>
          <div className={classes.selectorFooter}>
            <span>Выбрано: {selectedEmployees.length} из {employees.length}</span>
            <Button variant="primary" onClick={fetchAnalytics}>
              Применить и загрузить
            </Button>
          </div>
        </div>
      )}

      {analyticsData && (
        <>
          {/* Общая статистика */}
          <div className={classes.statsGrid}>
            <div className={classes.statCard}>
              <div className={classes.statIcon} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <FaChartLine />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Всего действий</span>
                <span className={classes.statValue}>{analyticsData.summary?.totalActions?.toLocaleString()}</span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon} style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                <FaComments />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Комментариев</span>
                <span className={classes.statValue}>{analyticsData.summary?.totalComments?.toLocaleString()}</span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon} style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                <FaExchangeAlt />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Изменений</span>
                <span className={classes.statValue}>{analyticsData.summary?.totalHistoryEvents?.toLocaleString()}</span>
              </div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statIcon} style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                <FaTasks />
              </div>
              <div className={classes.statContent}>
                <span className={classes.statLabel}>Уникальных задач</span>
                <span className={classes.statValue}>{analyticsData.summary?.totalUniqueIssues?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* График активности по часам */}
          <div className={classes.section}>
            <h2><FaClock /> Активность по часам</h2>
            <div className={classes.hourlyChart}>
              {analyticsData.hourlyActivity?.map((hourData) => {
                const maxValue = Math.max(...analyticsData.hourlyActivity.map(h => h.total));
                const percentage = (hourData.total / maxValue) * 100;

                return (
                  <div key={hourData.hour} className={classes.hourBar}>
                    <div
                      className={classes.hourBarFill}
                      style={{
                        height: `${percentage}%`,
                        background: hourData.total > maxValue * 0.7
                          ? 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)'
                          : hourData.total > maxValue * 0.4
                          ? 'linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)'
                          : 'linear-gradient(180deg, #43e97b 0%, #38f9d7 100%)'
                      }}
                    >
                      <span className={classes.hourValue}>{hourData.total}</span>
                    </div>
                    <div className={classes.hourLabel}>{hourData.hour}:00</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Топ сотрудников с прогресс-барами */}
          {topEmployees.length > 0 && (
            <div className={classes.section}>
              <h2><FaTrophy /> Топ активных сотрудников</h2>
              <div className={classes.topEmployeesList}>
                {topEmployees.map((emp, index) => {
                  const maxActions = topEmployees[0].totalActions;
                  const percentage = (emp.totalActions / maxActions) * 100;

                  return (
                    <div key={emp.id} className={classes.topEmployeeRow}>
                      <div className={classes.employeeRank}>
                        <span className={`${classes.rankBadge} ${classes[`rank${index + 1}`]}`}>
                          {index + 1}
                        </span>
                      </div>
                      <div className={classes.employeeDetails}>
                        <div className={classes.employeeName}>
                          <FaUser />
                          <span>{getEmployeeName(emp.id)}</span>
                        </div>
                        <div className={classes.progressBar}>
                          <div
                            className={classes.progressFill}
                            style={{
                              width: `${percentage}%`,
                              background: index === 0
                                ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                                : index === 1
                                ? 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)'
                                : 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)'
                            }}
                          />
                        </div>
                      </div>
                      <div className={classes.employeeMetrics}>
                        <div className={classes.metric}>
                          <FaChartLine />
                          <span>{emp.totalActions}</span>
                        </div>
                        <div className={classes.metric}>
                          <FaComments />
                          <span>{emp.comments.count}</span>
                        </div>
                        <div className={classes.metric}>
                          <FaTasks />
                          <span>{emp.comments.uniqueIssues + emp.historyEvents.uniqueIssues}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Детальная информация по сотрудникам */}
          <div className={classes.section}>
            <h2><FaUsers /> Детальная статистика сотрудников</h2>
            <div className={classes.employeesGrid}>
              {analyticsData.employeeStats?.map(empData => {
                return (
                  <div key={empData.id} className={classes.employeeCard}>
                    <div className={classes.employeeHeader}>
                      <div className={classes.employeeAvatar}>
                        <FaUser size={24} />
                      </div>
                      <div className={classes.employeeInfo}>
                        <h3>{getEmployeeName(empData.accountId)}</h3>
                        <span className={classes.employeeEmail}>{getEmployeeEmail(empData.accountId)}</span>
                      </div>
                    </div>

                    <div className={classes.employeeStats}>
                      <div className={classes.statRow}>
                        <span className={classes.statLabel}>
                          <FaChartLine /> Всего действий
                        </span>
                        <span className={classes.statValue}>{empData.totalActions}</span>
                      </div>
                      <div className={classes.statRow}>
                        <span className={classes.statLabel}>
                          <FaComments /> Комментариев
                        </span>
                        <span className={classes.statValue}>{empData.comments.count}</span>
                      </div>
                      <div className={classes.statRow}>
                        <span className={classes.statLabel}>
                          <FaExchangeAlt /> Изменений
                        </span>
                        <span className={classes.statValue}>{empData.historyEvents.count}</span>
                      </div>
                      <div className={classes.statRow}>
                        <span className={classes.statLabel}>
                          <FaTasks /> Уникальных задач
                        </span>
                        <span className={classes.statValue}>
                          {empData.comments.uniqueIssues + empData.historyEvents.uniqueIssues}
                        </span>
                      </div><div className={classes.statRow}>
                        <span className={classes.statLabel}>
                          <FaCalendarAlt /> Активных дней
                        </span>
                        <span className={classes.statValue}>{empData.activeDays}</span>
                      </div>
                      <div className={classes.statRow}>
                        <span className={classes.statLabel}>
                          <FaClock /> Пик активности
                        </span>
                        <span className={classes.statValue}>{empData.peakActivityHour}:00</span>
                      </div>
                    </div>

                    {/* Распределение активности по типам */}
                    <div className={classes.activityDistribution}>
                      <h4><FaChartPie /> Распределение активности</h4>
                      <div className={classes.pieChart}>
                        <div
                          className={classes.pieSegment}
                          style={{
                            '--percentage': `${(empData.comments.count / empData.totalActions) * 100}%`,
                            '--color': '#f093fb'
                          }}
                        />
                        <div className={classes.pieCenter}>
                          <span>{empData.totalActions}</span>
                          <small>действий</small>
                        </div>
                      </div><div className={classes.pieLegend}>
                        <div className={classes.legendItem}>
                          <span className={classes.legendDot} style={{ background: '#f093fb' }} />
                          <span>Комментарии: {empData.comments.count}</span>
                        </div>
                        <div className={classes.legendItem}>
                          <span className={classes.legendDot} style={{ background: '#4facfe' }} />
                          <span>Изменения: {empData.historyEvents.count}</span>
                        </div>
                      </div>
                    </div>

                    {/* График активности по часам для сотрудника */}
                    {empData.hourlyDistribution && (
                      <div className={classes.eventTypes}>
                        <h4><FaClock /> Распределение по часам</h4>
                        <div className={classes.hourlyMini}>
                          {empData.hourlyDistribution.map((count, hour) => {
                            const maxHourly = Math.max(...empData.hourlyDistribution);
                            return count > 0 && (
                              <div key={hour} className={classes.hourMiniBar}>
                                <div
                                  className={classes.hourMiniFill}
                                  style={{
                                    height: `${(count / maxHourly) * 100}%`
                                  }}
                                  title={`${hour}:00 - ${count} действий`}
                                />
                                <span>{hour}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Топ типов изменений */}
                    {empData.historyEvents.byType && Object.keys(empData.historyEvents.byType).length > 0 && (
                      <div className={classes.eventTypes}>
                        <h4><FaCode /> Типы изменений</h4>
                        <div className={classes.eventTypesList}>
                          {Object.entries(empData.historyEvents.byType)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([type, count]) => {
                              const maxType = Object.values(empData.historyEvents.byType).reduce((a, b) => Math.max(a, b), 0);
                              const percentage = (count / maxType) * 100;

                              return (
                                <div key={type} className={classes.eventTypeItem}>
                                  <span className={classes.eventTypeName}>{type}</span>
                                  <div className={classes.eventTypeBar}>
                                    <div
                                      className={classes.eventTypeBarFill}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span className={classes.eventTypeCount}>{count}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!analyticsData && (
        <div className={classes.empty}>
          <FaChartLine size={64} />
          <h3>Нет данных</h3>
          <p>Выберите отдел, сотрудников и период для отображения аналитики</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeActivityAnalyticsPage;

