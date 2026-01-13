import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URLS } from '../utils/apiUrls';
import { FaUser, FaEdit, FaTrash, FaSpinner, FaSearch, FaClock } from 'react-icons/fa';
import Select from "../UX/Select";
import classes from './WorkSchedulePage.module.css';
import MainContainer from "../components/MainContainer/MainContainer";
import { useNotification } from "../contexts/NotificationProvider";
import Radio from "../UX/Radio";
import Button from "../UX/Button";
import Switch from "../UX/Switch";

const WorkSchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('none');
  const [selectedId, setSelectedId] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editScheduleId, setEditScheduleId] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { setNotification } = useNotification();

  // Состояние для редактируемого расписания
  const [editableSchedule, setEditableSchedule] = useState({
    shifts: {},
    limits: {
      maxDailyIssues: 30,
      maxActiveIssues: 30,
      preferredLoadPercent: 80
    }
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const token = localStorage.getItem('accessToken') || "3333";
      const response = await axios.get(API_URLS.GET_WORK_SCHEDULES, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    const options = response.data.map(user => ({
        value: user.accountId,
        label: user.assigneeName
      }));

      setAssignees(options);
      setSchedules(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка при загрузке расписаний:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось загрузить расписания смен',
        has: true
      });
      setLoading(false);
    }
  };

  // const fetchAssignees = async () => {
  //   try {
  //     const token = localStorage.getItem('accessToken') || "3333";
  //     const response = await axios.get(API_URLS.GET_ASSIGNEES('displayName,accountId'), {
  //       headers: {
  //         Authorization: `Bearer ${token}`
  //       }
  //     });
  //
  //     const options = response.data.map(user => ({
  //       value: user.accountId,
  //       label: user.displayName
  //     }));
  //
  //     setAssignees(options);
  //   } catch (error) {
  //     console.error('Ошибка при загрузке сотрудников:', error);
  //     setNotification({
  //       type: 'error',
  //       message: 'Не удалось загрузить список сотрудников',
  //       has: true
  //     });
  //   }
  // };

  const handleSearch = async () => {
    if (!selectedId) {
      setNotification({
        type: 'warning',
        message: 'Пожалуйста, выберите сотрудника для поиска',
        has: true
      });
      return;
    }

    setSearchLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      let response;

      if (searchType === 'account') {
        response = await axios.get(API_URLS.GET_WORK_SCHEDULE_BY_ACCOUNT_ID(selectedId), {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } else if (searchType === 'assignee') {
        response = await axios.get(API_URLS.GET_WORK_SCHEDULE_BY_ASSIGNEE_ID(selectedId), {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      } else {
        setNotification({
          type: 'warning',
          message: 'Пожалуйста, выберите тип поиска',
          has: true
        });
        setSearchLoading(false);
        return;
      }

      if (response.data) {
        setSchedules([response.data]);
      } else {
        setSchedules([]);
        setNotification({
          type: 'info',
          message: 'Расписание не найдено',
          has: true
        });
      }
    } catch (error) {
      console.error('Ошибка при поиске расписания:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось найти расписание',
        has: true
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleReset = () => {
    setSearchType('none');
    setSelectedId(null);
    fetchSchedules();
  };

  const handleToggleActive = async (scheduleId, currentStatus) => {
    setUpdatingStatus(true);
    try {
      const token = localStorage.getItem('accessToken');
      await axios.patch(
        API_URLS.CHANGE_ACTIVE_STATUS(scheduleId),
        { isActive: !currentStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Обновление статуса в локальном состоянии
      setSchedules(schedules.map(schedule => {
        if (schedule._id === scheduleId) {
          return { ...schedule, isActive: !currentStatus };
        }
        return schedule;
      }));

      setNotification({
        type: 'success',
        message: `Статус расписания успешно ${!currentStatus ? 'активирован' : 'деактивирован'}`,
        has: true
      });
    } catch (error) {
      console.error('Ошибка при изменении статуса:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось изменить статус расписания',
        has: true
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEdit = (schedule) => {
    setEditScheduleId(schedule._id);
    setEditableSchedule({
      shifts: { ...schedule.shifts },
      limits: { ...schedule.limits }
    });
  };

  const handleCancelEdit = () => {
    setEditScheduleId(null);
    setEditableSchedule({
      shifts: {},
      limits: {
        maxDailyIssues: 30,
        maxActiveIssues: 30,
        preferredLoadPercent: 80
      }
    });
  };

  const handleShiftChange = (day, field, value) => {
    setEditableSchedule(prev => {
      const shifts = { ...prev.shifts };

      if (!shifts[day]) {
        shifts[day] = { startTime: "09:00", endTime: "18:00" };
      }

      shifts[day] = { ...shifts[day], [field]: value };

      return { ...prev, shifts };
    });
  };

  const handleDeleteShift = (day) => {
    setEditableSchedule(prev => {
      const shifts = { ...prev.shifts };
      delete shifts[day];
      return { ...prev, shifts };
    });
  };

  const handleAddShift = () => {
    // Находим первый незанятый день недели
    for (let i = 0; i < 7; i++) {
      if (!editableSchedule.shifts[i]) {
        handleShiftChange(i.toString(), 'startTime', '09:00');
        handleShiftChange(i.toString(), 'endTime', '18:00');
        break;
      }
    }
  };

  const searchTypeOptions = [
      {value: 'all', label: 'Все схемы'},
      {value: 'account', label: 'По сотруднику'},
      {value: 'department', label: 'По департаменту'}
  ];

  const handleLimitChange = (field, value) => {
    setEditableSchedule(prev => ({
      ...prev,
      limits: { ...prev.limits, [field]: parseInt(value) }
    }));
  };

  const handleSaveSchedule = async () => {
    try {
      const token = localStorage.getItem('accessToken');

      await axios.put(
        API_URLS.GET_WORK_SCHEDULE_BY_ID(editScheduleId),
        { shifts: editableSchedule.shifts, limits: editableSchedule.limits },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Обновляем локальное состояние
      setSchedules(schedules.map(schedule => {
        if (schedule._id === editScheduleId) {
          return { ...schedule, shifts: editableSchedule.shifts, limits: editableSchedule.limits };
        }
        return schedule;
      }));

      setEditScheduleId(null);

      setNotification({
        type: 'success',
        message: 'Расписание успешно обновлено',
        has: true
      });
    } catch (error) {
      console.error('Ошибка при обновлении расписания:', error);
      setNotification({
        type: 'error',
        message: 'Не удалось обновить расписание',
        has: true
      });
    }
  };

  const getDayName = (day) => {
    const days = [
      'Воскресенье',
      'Понедельник',
      'Вторник',
      'Среда',
      'Четверг',
      'Пятница',
      'Суббота'
    ];
    return days[parseInt(day)];
  };

  if (loading) {
    return <MainContainer isLoading={loading} />;
  }

  return (
    <MainContainer>
      <div className={classes.workSchedulePage}>
        <div className={classes.pageHeader}>
          <h1><FaClock className={classes.headerIcon} /> Расписание смен</h1>
          <p>Управление графиками работы сотрудников</p>
        </div>
        <div className={classes.searchContainer}>
          <div className={classes.searchControls}>
            <div className={classes.searchTypeSelector}>
              <label>Тип поиска:</label>
              <div className={classes.radioGroup}>
                <Radio
                  name="searchType"
                  options={searchTypeOptions}
                  selectedValue={searchType}
                  onChange={(value) => setSearchType(value)}
                />
              </div>
            </div>

            {searchType === 'account' && (
              <div className={classes.searchSelector}>
                <Select
                  style={{
                    minWidth: '250px',
                  }}
                  className={classes.assigneeSelect}
                  value={selectedId}
                  onChange={(option) => setSelectedId(option.target?.value || null)}
                  options={assignees}
                  placeholder="Выберите сотрудника"
                  isSearchable
                  noOptionsMessage={() => "Сотрудники не найдены"}
                  isDisabled={searchType === 'none'}
                />
                <Button
                  variant="primary"
                  onClick={handleSearch}
                  disabled={searchLoading || !selectedId}
                >
                  {searchLoading ? <FaSpinner className={classes.spinIcon} /> : <FaSearch />} Поиск
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleReset}
                  disabled={searchLoading}
                >
                  Сбросить
                </Button>
              </div>
            )}
              {searchType === 'department' && (
              <div className={classes.searchSelector}>
                <Select
                  style={{
                    minWidth: '250px',
                  }}
                  className={classes.assigneeSelect}
                  value={selectedId}
                  onChange={(option) => setSelectedId(option.target?.value || null)}
                  options={assignees}
                  placeholder="Выберите департамент"
                  isSearchable
                  noOptionsMessage={() => "департаменты не найдены"}
                  isDisabled={searchType === 'none'}
                />
                <Button
                  variant="primary"
                  onClick={handleSearch}
                  disabled={searchLoading || !selectedId}
                >
                  {searchLoading ? <FaSpinner className={classes.spinIcon} /> : <FaSearch />} Поиск
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleReset}
                  disabled={searchLoading}
                >
                  Сбросить
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className={classes.schedulesList}>
          {schedules.length === 0 ? (
            <div className={classes.emptySchedules}>
              <p>Расписания не найдены</p>
            </div>
          ) : (
            schedules.map((schedule) => (
              <div
                className={`${classes.scheduleCard} ${schedule.isActive ? classes.active : classes.inactive}`}
                key={schedule._id}
              >
                <div className={classes.scheduleHeader}>
                  <div className={classes.assigneeInfo}>
                    <div className={classes.assigneeAvatar}>
                      <FaUser />
                    </div>
                    <div className={classes.assigneeDetails}>
                      <h3>{schedule.assigneeName || 'Сотрудник'}</h3>
                      <span className={classes.accountId}>{schedule.accountId}</span>
                    </div>
                  </div>

                  <div className={classes.scheduleStatus}>
                    <span className={`${classes.statusBadge} ${schedule.isActive ? classes.active : classes.inactive}`}>
                      {schedule.isActive ? 'Активно' : 'Неактивно'}
                    </span>
                  </div>
                </div>

                {editScheduleId === schedule._id ? (
                  <div className={classes.editScheduleForm}>
                    <h4>Редактирование расписания</h4>

                    <div className={classes.limitsSection}>
                      <h5>Лимиты задач</h5>
                      <div className={classes.limitsForm}>
                        <div className={classes.formGroup}>
                          <label>Макс. задач в день:</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editableSchedule.limits.maxDailyIssues}
                            onChange={(e) => handleLimitChange('maxDailyIssues', e.target.value)}
                          />
                        </div>
                        <div className={classes.formGroup}>
                          <label>Макс. активных задач:</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editableSchedule.limits.maxActiveIssues}
                            onChange={(e) => handleLimitChange('maxActiveIssues', e.target.value)}
                          />
                        </div>
                        <div className={classes.formGroup}>
                          <label>Предпочтительная загрузка (%):</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={editableSchedule.limits.preferredLoadPercent}
                            onChange={(e) => handleLimitChange('preferredLoadPercent', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className={classes.shiftsSection}>
                      <div className={classes.sectionHeader}>
                        <h5>Рабочие смены</h5>
                        <button
                          className={classes.addShiftButton}
                          onClick={handleAddShift}
                          disabled={Object.keys(editableSchedule.shifts).length >= 7}
                        >
                          + Добавить смену
                        </button>
                      </div>

                      <div className={classes.shiftsForm}>
                        {Object.keys(editableSchedule.shifts).length > 0 ? (
                          Object.entries(editableSchedule.shifts).map(([day, shift]) => (
                            <div className={classes.shiftItem} key={day}>
                              <div className={classes.dayName}>
                                {getDayName(day)}
                              </div>
                              <div className={classes.timeInputs}>
                                <div className={classes.timeGroup}>
                                  <label>Начало:</label>
                                  <input
                                    type="time"
                                    value={shift.startTime}
                                    onChange={(e) => handleShiftChange(day, 'startTime', e.target.value)}
                                  />
                                </div>
                                <div className={classes.timeGroup}>
                                  <label>Конец:</label>
                                  <input
                                    type="time"
                                    value={shift.endTime}
                                    onChange={(e) => handleShiftChange(day, 'endTime', e.target.value)}
                                  />
                                </div>
                                <button
                                  className={classes.deleteShiftButton}
                                  onClick={() => handleDeleteShift(day)}
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className={classes.emptyShifts}>
                            <p>Нет добавленных смен</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={classes.editActions}>
                      <Button
                        variant="secondary"
                        onClick={handleCancelEdit}
                      >
                        Отмена
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleSaveSchedule}
                      >
                        Сохранить изменения
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={classes.limitsInfo}>
                      <h4>Лимиты задач</h4>
                      <div className={classes.limitsGrid}>
                        <div className={classes.limitItem}>
                          <span className={classes.limitLabel}>Макс. задач в день:</span>
                          <span className={classes.limitValue}>{schedule.limits?.maxDailyIssues || 'Не задано'}</span>
                        </div>
                        <div className={classes.limitItem}>
                          <span className={classes.limitLabel}>Макс. активных задач:</span>
                          <span className={classes.limitValue}>{schedule.limits?.maxActiveIssues || 'Не задано'}</span>
                        </div>
                        <div className={classes.limitItem}>
                          <span className={classes.limitLabel}>Предпочтительная загрузка:</span>
                          <span className={classes.limitValue}>{schedule.limits?.preferredLoadPercent || 0}%</span>
                        </div>
                      </div>
                    </div>

                    <div className={classes.shiftsInfo}>
                      <h4>Рабочие смены</h4>
                      <div className={classes.shiftsGrid}>
                        {Object.keys(schedule.shifts || {}).length > 0 ? (
                          Object.entries(schedule.shifts).map(([day, shift]) => (
                            <div className={classes.shiftBlock} key={day}>
                              <div className={classes.shiftDay}>{getDayName(day)}</div>
                              <div className={classes.shiftTime}>
                                {shift.startTime} - {shift.endTime}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className={classes.emptyShifts}>
                            <p>Нет добавленных смен</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className={classes.scheduleFooter}>
                  <div className={classes.scheduleMeta}>
                    <span className={classes.createdAt}>
                      Создано: {new Date(schedule.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                    <span className={classes.updatedAt}>
                      Обновлено: {new Date(schedule.updatedAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div className={classes.scheduleActions}>
                    <div className={classes.toggleWrapper}>
                      <Switch
                        id={`toggle-${schedule._id}`}
                        checked={schedule.isActive}
                        onChange={() => handleToggleActive(schedule._id, schedule.isActive)}
                        disabled={updatingStatus}
                        version="1"
                      />
                      <span className={classes.toggleLabel}>
                        {schedule.isActive ? 'Активно' : 'Неактивно'}
                      </span>
                    </div>
                    <button
                      className={classes.editButton}
                      onClick={() => handleEdit(schedule)}
                      disabled={editScheduleId !== null}
                    >
                      <FaEdit /> Редактировать
                    </button>
                    <button
                      className={classes.deleteButton}
                      disabled={true}
                      title="Функция недоступна"
                    >
                      <FaTrash /> Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MainContainer>
  );
};

export default WorkSchedulePage;