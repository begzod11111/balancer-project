import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaPlus, FaEdit, FaTrash, FaUndo, FaCog, FaChartLine } from 'react-icons/fa';
import Button from '../../components/Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import CreateDepartmentModal from '../../components/CreateDepartmentModal/CreateDepartmentModal';
import EditDepartmentModal from '../../components/EditDepartmentModal/EditDepartmentModal';
import ConfigureDepartmentModal from '../../components/ConfigureDepartmentModal/ConfigureDepartmentModal';
import classes from './DepartmentsPage.module.css';

const DepartmentsPage = () => {
  const { notify } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  const [departments, setDepartments] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [configuringDepartment, setConfiguringDepartment] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    active: 'all',
    showDeleted: false
  });

  useEffect(() => {
    fetchDepartments();
    fetchStats();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [departments, filters]);

  const fetchDepartments = async () => {
    showLoader();
    try {
      const { data } = await axios.get(URLS.GET_DEPARTMENTS, {
        params: { deleted: filters.showDeleted, },
          headers : {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
        }
      });

      if (data.success) {
        setDepartments(data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки департаментов:', error);
      notify.error('Не удалось загрузить департаменты', );
    } finally {
      hideLoader();
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(URLS.GET_DEPARTMENTS_STATS, {
        headers : {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        }
      });
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...departments];

    // Поиск
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(dept =>
        dept.name.toLowerCase().includes(searchLower) ||
        dept.ObjectId.toLowerCase().includes(searchLower) ||
        (dept.description && dept.description.toLowerCase().includes(searchLower))
      );
    }

    // Статус активности
    if (filters.active !== 'all') {
      filtered = filtered.filter(dept => dept.active === (filters.active === 'active'));
    }

    // Удаленные
    if (!filters.showDeleted) {
      filtered = filtered.filter(dept => !dept.delete);
    }

    setFilteredDepartments(filtered);
  };

  const handleToggleStatus = async (departmentId, currentStatus) => {
    try {
      const { data } = await axios.patch(
        URLS.TOGGLE_DEPARTMENT_STATUS(departmentId),
        { active: !currentStatus },
          {headers : {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
              }}
      );

      if (data.success) {
        setDepartments(prev =>
          prev.map(dept => dept._id === departmentId ? data.data : dept)
        );
        notify.success(`Департамент ${!currentStatus ? 'активирован' : 'деактивирован'}`);
      }
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      notify.error('Не удалось изменить статус департамента');
    }
  };

  const handleDelete = async (departmentId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот департамент?')) {
      return;
    }

    try {
      const { data } = await axios.delete(
        URLS.UPDATE_DEPARTMENT(departmentId)
      );

      if (data.success) {
        setDepartments(prev =>
          prev.map(dept => dept._id === departmentId ? data.data : dept)
        );
        notify.success('Департамент удален');
        fetchStats();
      }
    } catch (error) {
      console.error('Ошибка удаления:', error);
      notify.error('Не удалось удалить департамент');
    }
  };

  const handleRestore = async (departmentId) => {
    try {
      const { data } = await axios.post(
        URLS.DEPARTMENT_RESTORE(departmentId)
      );

      if (data.success) {
        setDepartments(prev =>
          prev.map(dept => dept._id === departmentId ? data.data : dept)
        );
        notify.success('Департамент восстановлен');
        fetchStats();
      }
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      notify.error('Не удалось восстановить департамент');
    }
  };

  const handleCreateSuccess = (newDepartment) => {
    setDepartments(prev => [newDepartment, ...prev]);
    notify.success('Департамент создан');
    fetchStats();
  };

  const handleEditSuccess = (updatedDepartment) => {
    setDepartments(prev =>
      prev.map(dept => dept._id === updatedDepartment._id ? updatedDepartment : dept)
    );
    notify.success('Департамент обновлен');
  };

  const handleConfigureSuccess = (updatedDepartment) => {
    setDepartments(prev =>
      prev.map(dept => dept._id === updatedDepartment._id ? updatedDepartment : dept)
    );
    notify.success('Настройки департамента обновлены',);
  };

  return (
    <div className={classes.page}>
      {/* Header */}
      <header className={classes.header}>
        <div>
          <h1>Управление департаментами</h1>
          {stats && (
            <div className={classes.stats}>
              <span className={classes.statItem}>
                Всего: <strong>{stats.total}</strong>
              </span>
              <span className={classes.statItem}>
                Активных: <strong>{stats.active}</strong>
              </span>
              <span className={classes.statItem}>
                Неактивных: <strong>{stats.inactive}</strong>
              </span>
              {stats.deleted > 0 && (
                <span className={classes.statItem}>
                  Удаленных: <strong>{stats.deleted}</strong>
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className={classes.createBtn}
        >
          <FaPlus /> Создать департамент
        </Button>
      </header>

      {/* Filters */}
      <div className={classes.filters}>
        <input
          type="text"
          placeholder="Поиск по названию, ID или описанию..."
          value={filters.search}
          onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          className={classes.searchInput}
        />

        <select
          value={filters.active}
          onChange={(e) => setFilters(prev => ({ ...prev, active: e.target.value }))}
          className={classes.filterSelect}
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>

        <label className={classes.checkboxLabel}>
          <input
            type="checkbox"
            checked={filters.showDeleted}
            onChange={(e) => setFilters(prev => ({ ...prev, showDeleted: e.target.checked }))}
          />
          Показать удаленные
        </label>
      </div>

      {/* Department Cards */}
      <div className={classes.departmentGrid}>
        {filteredDepartments.length === 0 ? (
          <div className={classes.emptyState}>
            <p>Департаменты не найдены</p>
          </div>
        ) : (
          filteredDepartments.map((department) => (
            <div
              key={department._id}
              className={`${classes.card} ${!department.active ? classes.inactive : ''} ${department.delete ? classes.deleted : ''}`}
            >
              <div className={classes.cardHeader}>
                <div>
                  <h3>{department.name}</h3>
                  <span className={classes.objectId}>{department.ObjectId}</span>
                </div>
                <div className={classes.badges}>
                  {department.active ? (
                    <span className={classes.badgeActive}>Активен</span>
                  ) : (
                    <span className={classes.badgeInactive}>Неактивен</span>
                  )}
                  {department.delete && (
                    <span className={classes.badgeDeleted}>Удален</span>
                  )}
                </div>
              </div>

              {department.description && (
                <p className={classes.description}>{department.description}</p>
              )}

              <div className={classes.configInfo}>
                <div className={classes.configItem}>
                  <span className={classes.configLabel}>Типов задач:</span>
                  <span className={classes.configValue}>
                    {Object.keys(department.taskTypeWeights || {}).length}
                  </span>
                </div>
                <div className={classes.configItem}>
                  <span className={classes.configLabel}>Макс. загрузка:</span>
                  <span className={classes.configValue}>{department.defaultMaxLoad || 100}</span>
                </div>
                <div className={classes.configItem}>
                  <span className={classes.configLabel}>Приоритет:</span>
                  <span className={classes.configValue}>{department.priorityMultiplier || 1.0}x</span>
                </div>
              </div>

              {department.loadCalculationFormula && (
                <div className={classes.formula}>
                  <span className={classes.formulaLabel}>Формула:</span>
                  <code className={classes.formulaCode}>{department.loadCalculationFormula}</code>
                </div>
              )}

              <div className={classes.cardActions}>
                {!department.delete ? (
                  <>
                    <button
                      onClick={() => handleToggleStatus(department._id, department.active)}
                      className={classes.actionBtn}
                      title={department.active ? 'Деактивировать' : 'Активировать'}
                    >
                      {department.active ? '🔴' : '🟢'}
                    </button>
                    <button
                      onClick={() => setConfiguringDepartment(department)}
                      className={classes.actionBtn}
                      title="Настройки"
                    >
                      <FaCog />
                    </button>
                    <button
                      onClick={() => setEditingDepartment(department)}
                      className={classes.actionBtn}
                      title="Редактировать"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(department._id)}
                      className={`${classes.actionBtn} ${classes.deleteBtn}`}
                      title="Удалить"
                    >
                      <FaTrash />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleRestore(department._id)}
                    className={`${classes.actionBtn} ${classes.restoreBtn}`}
                    title="Восстановить"
                  >
                    <FaUndo />
                  </button>
                )}
              </div>

              <div className={classes.cardFooter}>
                <small>Создан: {new Date(department.createdAt).toLocaleString('ru-RU')}</small>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <CreateDepartmentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {editingDepartment && (
        <EditDepartmentModal
          isOpen={true}
          department={editingDepartment}
          onClose={() => setEditingDepartment(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {configuringDepartment && (
        <ConfigureDepartmentModal
          isOpen={true}
          department={configuringDepartment}
          onClose={() => setConfiguringDepartment(null)}
          onSuccess={handleConfigureSuccess}
        />
      )}
    </div>
  );
};

export default DepartmentsPage;
