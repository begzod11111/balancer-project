// packages/crm/src/pages/TypesPage/TypesPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import {
  FaPlus,
  FaFilter,
  FaRedo,
  FaChartBar,
  FaEdit,
  FaTrash,
  FaTasks,
  FaToggleOn,
  FaToggleOff,
  FaSearch,
  FaInfoCircle
} from 'react-icons/fa';
import Button from '../../components/Button/Button';
import Select from '../../components/Select/Select';
import Input from '../../components/Input/Input';
import CreateTypeModal from '../../components/CreateTypeModal/CreateTypeModal';
import EditTypeModal from '../../components/EditTypeModal/EditTypeModal';
import ManageStatusesModal from '../../components/ManageStatusesModal/ManageStatusesModal';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './TypesPage.module.css';

const TypesPage = () => {
  const { notify } = useNotification();
  const loader = useLoader();

  // State
  const [types, setTypes] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusesModalOpen, setIsStatusesModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    active: null,
    category: null,
    search: '',
    sort: 'name'
  });

  // Options
  const statusOptions = [
    { value: null, label: 'Все статусы' },
    { value: true, label: 'Активные' },
    { value: false, label: 'Неактивные' }
  ];

  const categoryOptions = [
    { value: null, label: 'Все категории' },
    { value: 'task', label: 'Задача' },
    { value: 'bug', label: 'Баг' },
    { value: 'story', label: 'История' },
    { value: 'epic', label: 'Эпик' },
    { value: 'subtask', label: 'Подзадача' }
  ];

  const sortOptions = [
    { value: 'name', label: 'По названию (А-Я)' },
    { value: '-name', label: 'По названию (Я-А)' },
    { value: 'category', label: 'По категории' },
    { value: '-defaultWeight', label: 'По весу (↓)' },
    { value: 'defaultWeight', label: 'По весу (↑)' },
    { value: '-createdAt', label: 'Сначала новые' },
    { value: 'createdAt', label: 'Сначала старые' }
  ];

  // Загрузка типов
  const fetchTypes = useCallback(async () => {
    try {
      loader.showLoader('Загрузка типов...');

      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams();

      if (filters.active !== null) params.append('active', filters.active);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.sort) params.append('sort', filters.sort);

      const response = await axios.get(`${URLS.GET_ALL_TYPES}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setTypes(response.data.data || []);
      }
    } catch (error) {
      console.error('Ошибка загрузки типов:', error);
      notify.error(error.response?.data?.message || 'Ошибка при загрузке типов');
    } finally {
      loader.hideLoader();
    }
  }, [filters, loader, notify]);

  // Загрузка статистики
  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_TYPES_STATS, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  }, []);

  // Effects
  useEffect(() => {
    fetchTypes();
    fetchStats();
  }, []);

  // Handlers
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      active: null,
      category: null,
      search: '',
      sort: 'name'
    });
  };

  const handleCreateType = async (typeData) => {
    try {

      if (typeData.success) {
        notify.success('Тип успешно создан');
        setIsCreateModalOpen(false);
        fetchTypes();
        fetchStats();
      }
    } catch (error) {
      console.error('Ошибка создания типа:', error);
      notify.error(error.response?.data?.message || 'Ошибка при создании типа');
    }
  };

  const handleEditType = (type) => {
    setSelectedType(type);
    setIsEditModalOpen(true);
  };

  const handleUpdateType = async (typeId, updateData) => {
    try {
      loader.showLoader('Обновление типа...');

      const token = localStorage.getItem('accessToken');
      const response = await axios.put(URLS.UPDATE_TYPE(typeId), updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        notify.success('Тип успешно обновлён');
        setIsEditModalOpen(false);
        setSelectedType(null);
        fetchTypes();
      }
    } catch (error) {
      console.error('Ошибка обновления типа:', error);
      notify.error(error.response?.data?.message || 'Ошибка при обновлении типа');
    } finally {
      loader.hideLoader();
    }
  };

  const handleToggleStatus = async (typeId, active) => {
    try {
      loader.showLoader('Изменение статуса...');

      const token = localStorage.getItem('accessToken');
      const response = await axios.patch(
        URLS.TOGGLE_TYPE_STATUS(typeId),
        { active },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        notify.success(`Тип ${active ? 'активирован' : 'деактивирован'}`);
        fetchTypes();
        fetchStats();
      }
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      notify.error(error.response?.data?.message || 'Ошибка при изменении статуса');
    } finally {
      loader.hideLoader();
    }
  };

  const handleDeleteType = async (typeId) => {
    if (!window.confirm('Удалить этот тип? Это действий можно отменить.')) {
      return;
    }

    try {
      loader.showLoader('Удаление типа...');

      const token = localStorage.getItem('accessToken');
      const response = await axios.delete(URLS.DELETE_TYPE(typeId), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        notify.success('Тип успешно удалён');
        fetchTypes();
        fetchStats();
      }
    } catch (error) {
      console.error('Ошибка удаления типа:', error);
      notify.error(error.response?.data?.message || 'Ошибка при удалении типа');
    } finally {
      loader.hideLoader();
    }
  };

  const handleManageStatuses = (type) => {
    setSelectedType(type);
    setIsStatusesModalOpen(true);
  };

  const handleSyncFromJira = async () => {
    if (!window.confirm('Синхронизировать типы из Jira? Это может занять время.')) {
      return;
    }

    try {
      loader.showLoader('Синхронизация с Jira...');

      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        URLS.SYNC_TYPES_FROM_JIRA,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        notify.success('Синхронизация завершена');
        fetchTypes();
        fetchStats();
      }
    } catch (error) {
      console.error('Ошибка синхронизации:', error);
      notify.error(error.response?.data?.message || 'Ошибка при синхронизации');
    } finally {
      loader.hideLoader();
    }
  };

  // Мемоизация категорий для визуальных иконок
  const categoryIcons = {
    task: '📋',
    bug: '🐛',
    story: '📖',
    epic: '🎯',
    subtask: '📌'
  };

  const categoryColors = {
    task: '#4CAF50',
    bug: '#f44336',
    story: '#2196F3',
    epic: '#9C27B0',
    subtask: '#FF9800'
  };

  return (
    <div className={classes.container}>
      {/* Header */}
      <div className={classes.header}>
        <div className={classes.headerLeft}>
          <FaTasks className={classes.headerIcon} />
          <div>
            <h1 className={classes.title}>Управление типами задач</h1>
            <p className={classes.subtitle}>
              Настройка типов, весов и статусов для системы
            </p>
          </div>
        </div>

        <div className={classes.headerActions}>
          <Button
            variant="outline"
            onClick={handleSyncFromJira}
            icon={<FaRedo />}
          >
            Синхронизировать с Jira
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            icon={<FaFilter />}
          >
            Фильтры
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            icon={<FaPlus />}
          >
            Создать тип
          </Button>
        </div>
      </div>

{/* Статистика */}
{stats && (
  <div className={classes.statsGrid}>
    <div className={classes.statCard}>
      <FaChartBar className={classes.statIcon} />
      <div className={classes.statInfo}>
        <div className={classes.statValue}>{stats.total}</div>
        <div className={classes.statLabel}>Всего типов</div>
      </div>
    </div>
    <div className={classes.statCard}>
      <FaToggleOn className={classes.statIcon} style={{ color: '#4CAF50' }} />
      <div className={classes.statInfo}>
        <div className={classes.statValue}>{stats.active}</div>
        <div className={classes.statLabel}>Активных</div>
      </div>
    </div>
    <div className={classes.statCard}>
      <FaToggleOff className={classes.statIcon} style={{ color: '#999' }} />
      <div className={classes.statInfo}>
        <div className={classes.statValue}>{stats.inactive}</div>
        <div className={classes.statLabel}>Неактивных</div>
      </div>
    </div>
  </div>
)}


      {/* Filters */}
      {showFilters && (
        <div className={classes.filters}>
          <div className={classes.filterGroup}>
            <label>Поиск</label>
            <Input
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Название или ID типа..."
              icon={<FaSearch />}
            />
          </div>

          <div className={classes.filterGroup}>
            <label>Статус</label>
            <Select
              value={filters.active}
              onChange={(value) => handleFilterChange('active', value)}
              options={statusOptions}
            />
          </div>

          <div className={classes.filterGroup}>
            <label>Категория</label>
            <Select
              value={filters.category}
              onChange={(value) => handleFilterChange('category', value)}
              options={categoryOptions}
            />
          </div>

          <div className={classes.filterGroup}>
            <label>Сортировка</label>
            <Select
              value={filters.sort}
              onChange={(value) => handleFilterChange('sort', value)}
              options={sortOptions}
            />
          </div>

          <Button
            variant="outline"
            onClick={handleResetFilters}
            icon={<FaRedo />}
          >
            Сбросить
          </Button>
        </div>
      )}

      {/* Content */}
      <div className={classes.content}>
        {types.length === 0 ? (
          <div className={classes.emptyState}>
            <FaInfoCircle className={classes.emptyIcon} />
            <h3>Типы не найдены</h3>
            <p>Создайте новый тип или измените фильтры</p>
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              icon={<FaPlus />}
            >
              Создать первый тип
            </Button>
          </div>
        ) : (
          <div className={classes.typesList}>
            {types.map((type) => (
              <div
                key={type._id}
                className={`${classes.typeCard} ${!type.active ? classes.inactive : ''}`}
                style={{ borderLeftColor: categoryColors[type.category] || '#ccc' }}
              >
                <div className={classes.typeHeader}>
                  <div className={classes.typeInfo}>
                    <span className={classes.typeIcon}>
                      {type.icon || categoryIcons[type.category]}
                    </span>
                    <div>
                      <h3 className={classes.typeName}>{type.name}</h3>
                      <span className={classes.typeId}>ID: {type.typeId}</span>
                    </div>
                  </div>
                  <div className={classes.typeBadges}>
                    <span
                      className={classes.categoryBadge}
                      style={{ backgroundColor: categoryColors[type.category] }}
                    >
                      {type.category}
                    </span>
                    <span className={`${classes.statusBadge} ${type.active ? classes.active : classes.inactive}`}>
                      {type.active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                </div>

                {type.description && (
                  <p className={classes.typeDescription}>{type.description}</p>
                )}

                <div className={classes.typeStats}>
                  <div className={classes.typeStat}>
                    <span className={classes.statLabel}>Вес по умолчанию:</span>
                    <span className={classes.statValue}>{type.defaultWeight}</span>
                  </div>
                  <div className={classes.typeStat}>
                    <span className={classes.statLabel}>Статусов:</span>
                    <span className={classes.statValue}>{type.statuses?.length || 0}</span>
                  </div>
                </div>

                <div className={classes.typeActions}>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => handleManageStatuses(type)}
                    icon={<FaTasks />}
                  >
                    Статусы
                  </Button>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => handleEditType(type)}
                    icon={<FaEdit />}
                  >
                    Редактировать
                  </Button>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => handleToggleStatus(type._id, !type.active)}
                    icon={type.active ? <FaToggleOff /> : <FaToggleOn />}
                  >
                    {type.active ? 'Деактивировать' : 'Активировать'}
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => handleDeleteType(type._id)}
                    icon={<FaTrash />}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateTypeModal
            isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateType}
        />
      )}

      {isEditModalOpen && selectedType && (
        <EditTypeModal
          type={selectedType}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedType(null);
          }}
          onSave={handleUpdateType}
        />
      )}

      {isStatusesModalOpen && selectedType && (
        <ManageStatusesModal
          type={selectedType}
          onClose={() => {
            setIsStatusesModalOpen(false);
            setSelectedType(null);
          }}
          onUpdate={() => {
            fetchTypes();
            setIsStatusesModalOpen(false);
            setSelectedType(null);
          }}
        />
      )}
    </div>
  );
};

export default TypesPage;
