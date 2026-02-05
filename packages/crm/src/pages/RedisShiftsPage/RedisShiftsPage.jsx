// packages/crm/src/pages/RedisShiftsPage/RedisShiftsPage.jsx
import React, {useEffect, useState} from 'react';
import axios from 'axios';
import {URLS} from '../../utilities/urls';
import {FaChartBar, FaClock, FaFilter, FaPlus, FaSearch, FaTimes} from 'react-icons/fa';
import {useNotification} from '../../contexts/NotificationProvider';
import {useLoader} from '../../contexts/LoaderProvider';
import Button from '../../../src/components/Button/Button';
import Select from '../../../src/components/Select/Select';
import ShiftCard from '../../components/ShiftCard/ShiftCard';
import classes from './RedisShiftsPage.module.css';
import Input from "../../components/Input/Input";
import CreateShiftModal from "../../components/CreateShiftModal/CreateShiftModal";

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

    const {setNotification} = useNotification();
    const {showLoader, hideLoader} = useLoader();

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
                headers: {Authorization: `Bearer ${token}`}
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
    // Добавьте функцию расчёта TTL
    const calculateTTL = (endTime) => {
        if (!endTime) return 86400; // 24 часа по умолчанию

        const endDate = new Date(endTime);
        const now = new Date();
        const diffInSeconds = Math.floor((endDate - now) / 1000);

        // Минимум 60 секунд, максимум 7 дней (604800 сек)
        return Math.max(60, Math.min(604800, diffInSeconds));
    };

// Обновите useEffect для автоматического расчёта TTL
    useEffect(() => {
        if (newShift.shiftEndTime) {
            const calculatedTTL = calculateTTL(newShift.shiftEndTime);
            setNewShift(prev => ({
                ...prev,
                ttl: calculatedTTL
            }));
        }
    }, [newShift.shiftEndTime]);

    const fetchAssigneesByDepartment = async (departmentId) => {
        try {
            showLoader('Загрузка сотрудников...');
            const token = localStorage.getItem('accessToken') || "3333";
            const response = await axios.get(
                URLS.GET_WORK_SCHEDULE_BY_DEPARTMENT_ID(departmentId),
                {headers: {Authorization: `Bearer ${token}`}}
            );

            const assigneeOptions = response.data
                .map(schedule => ({
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
                {headers: {Authorization: `Bearer ${token}`}}
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
                {headers: {Authorization: `Bearer ${token}`}}
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
        console.log(assignee)
        setNewShift(prev => ({
            ...prev,
            accountId: assignee.value,
            assigneeName: assignee.label,
            assigneeEmail: assignee.email,
            limits: assignee.limits,
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

    const handleUpdateShift = (updatedShift) => {
        setShifts(prevShifts =>
            prevShifts.map(shift =>
                shift.departmentObjectId === updatedShift.departmentObjectId &&
                shift.accountId === updatedShift.accountId &&
                shift.assigneeEmail === updatedShift.assigneeEmail
                    ? updatedShift
                    : shift
            )
        );
    };


    const handleDeleteShift = async (shift) => {

        try {
            showLoader('Удаление смены...');
            const token = localStorage.getItem('accessToken') || "3333";

            await axios.delete(
                URLS.DELETE_REDIS_SHIFT(shift.departmentObjectId, shift.accountId, shift.assigneeEmail),
                {headers: {Authorization: `Bearer ${token}`}}
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
                {count: 1},
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
                    <FaPlus/> Добавить в пул
                </Button>
            </div>

            {/* Stats */}
            <div className={classes.stats}>
                <div className={classes.statCard}>
                    <FaChartBar/>
                    <div>
                        <span className={classes.statValue}>{stats.total}</span>
                        <span className={classes.statLabel}>Всего смен</span>
                    </div>
                </div>
                <div className={classes.statCard}>
                    <FaFilter/>
                    <div>
                        <span className={classes.statValue}>{stats.filtered}</span>
                        <span className={classes.statLabel}>Отфильтровано</span>
                    </div>
                </div>
                <div className={classes.statCard}>
                    <FaChartBar/>
                    <div>
                        <span className={classes.statValue}>{stats.departments}</span>
                        <span className={classes.statLabel}>Департаментов</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className={classes.filterPanel}>
                <div className={classes.filterHeader}>
                    <h3><FaFilter/> Фильтры</h3>
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
                            onUpdate={(updatedShift) => handleUpdateShift(updatedShift)}
                            onDelete={() => handleDeleteShift(shift)}
                            onIncrement={() => handleIncrementTasks(shift)}
                            formatDate={formatDate}
                            ttl={shift.ttl}
                        />
                    ))
                )}
            </div>



            <CreateShiftModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={fetchShifts}
                departments={departments}
            />

        </div>
    );
};

export default RedisShiftsPage;

