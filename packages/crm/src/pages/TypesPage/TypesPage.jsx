import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaPlus, FaFilter, FaRedo, FaChartBar } from 'react-icons/fa';
import Button from '../../components/Button/Button';
import Select from '../../components/Select/Select';
import TypeCard from '../../components/TypeCard/TypeCard';
import CreateTypeModal from '../../components/CreateTypeModal/CreateTypeModal';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './TypesPage.module.css';

const TypesPage = () => {
  const {notify} = useNotification();
  const loader = useLoader();

  const [types, setTypes] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState(null);

  const [filters, setFilters] = useState({
    active: null,
    category: null,
    search: '',
    sort: 'name'
  });

  const categoryOptions = [
    { value: null, label: 'Все категории' },
    { value: 'task', label: 'Задачи' },
    { value: 'bug', label: 'Баги' },
    { value: 'story', label: 'Истории' },
    { value: 'epic', label: 'Эпики' }
  ];

  const statusOptions = [
    { value: null, label: 'Все статусы' },
    { value: true, label: 'Только активные' },
    { value: false, label: 'Только неактивные' }
  ];

  const sortOptions = [
    { value: 'name', label: 'По названию' },
    { value: 'createdAt', label: 'По дате создания' },
    { value: 'defaultWeight', label: 'По весу' }
  ];

  const fetchTypes = useCallback(async () => {
    if (loader?.showLoader) loader.showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const params = {};

      if (filters.active !== null) params.active = filters.active;
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.sort) params.sort = filters.sort;

      const response = await axios.get(URLS.GET_ALL_TYPES, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      // Дополнительно загружаем связанные отделы для каждого типа
      const typesWithDepartments = await Promise.all(
        response.data.data.map(async (type) => {
          try {
            const deptResponse = await axios.get(URLS.GET_DEPARTMENTS, {
              headers: { Authorization: `Bearer ${token}` }
            });

            const linkedDepartments = deptResponse.data.data.filter(dept =>
              dept.taskTypeWeights && dept.taskTypeWeights[type.typeId]
            ).map(dept => ({
              ...dept,
              weight: dept.taskTypeWeights[type.typeId]?.weight
            }));

            return {
              ...type,
              departments: linkedDepartments
            };
          } catch (error) {
            console.error('Ошибка загрузки отделов для типа:', error);
            return type;
          }
        })
      );

      setTypes(typesWithDepartments);
    } catch (error) {
      console.error('Ошибка загрузки типов:', error);
        notify.error('Не удалось загрузить типы');

    } finally {
      if (loader?.hideLoader) loader.hideLoader();
    }
  }, [filters, loader, notify]);

 const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${URLS.GET_ALL_TYPES}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.data);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchStats();
  }, []);

  const handleCreateSuccess = (newType) => {
    setTypes(prev => [newType, ...prev]);
    fetchStats();
  };

  const handleToggleStatus = async (typeId, currentStatus) => {
    if (loader?.showLoader) loader.showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      await axios.patch(
        `${URLS.UPDATE_TYPE(typeId)}/active`,
        { active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTypes(prev => prev.map(t =>
        t._id === typeId ? { ...t, active: !currentStatus } : t
      ));


        notify.success(
          `Тип ${!currentStatus ? 'активирован' : 'деактивирован'}`,
        );

      fetchStats();
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
        notify.error('Не удалось изменить статус');

    } finally {
      if (loader?.hideLoader) loader.hideLoader();
    }
  };

  const handleDelete = async (typeId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот тип?')) {
      return;
    }

    if (loader?.showLoader) loader.showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      await axios.delete(URLS.DELETE_TYPE(typeId), {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTypes(prev => prev.filter(t => t._id !== typeId));
        notify.success('Тип успешно удален');

      fetchStats();
    } catch (error) {
      console.error('Ошибка удаления типа:', error);
        notify.error('Не удалось удалить тип',);

    } finally {
      if (loader?.hideLoader) loader.hideLoader();
    }
  };

  const handleReset = () => {
    setFilters({
      active: null,
      category: null,
      search: '',
      sort: 'name'
    });
    fetchTypes();
  };

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h1>Типы задач</h1>
          <p>Управление типами задач и их весами</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} icon={<FaPlus />}>
          Создать тип
        </Button>
      </header>

        {stats && (
            <div className={classes.stats}>
                <div className={classes.statCard}>
                    <FaChartBar/>
                    <div>
                        <span className={classes.statValue}>{stats.total}</span>
                        <span className={classes.statLabel}>Всего типов</span>
                    </div>
                </div>

                <div className={classes.statCard}>
                    <span className={classes.activeIndicator}>✓</span>
                    <div>
                        <span className={classes.statValue}>{stats.active}</span>
                        <span className={classes.statLabel}>Активных</span>
                    </div>
                </div>

                {/* Категории - используем Object.entries */}
                {Object.entries(stats.byCategory || {}).map(([category, data]) => (
                    <div key={category} className={classes.statCard}>
                        <FaChartBar/>
                        <div>
                <span className={classes.statValue}>
                  {data.count} {/* ВАЖНО: не data, а data.count */}
                </span>
                            <span className={classes.statLabel}>
                  {category === 'task' ? 'Задачи' :
                      category === 'bug' ? 'Баги' :
                          category === 'story' ? 'Истории' :
                              category === 'epic' ? 'Эпики' : 'Другое'}
                </span>
                        </div>
                    </div>
                ))}
            </div>
        )}

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
          <div className={classes.filters}>
            <div className={classes.filterRow}>
              <label>
                <span>Статус</span>
                <Select
                  options={statusOptions}
                  value={filters.active}
                  onChange={(value) => setFilters(prev => ({ ...prev, active: value }))}
                />
              </label>

              <label>
                <span>Категория</span>
                <Select
                  options={categoryOptions}
                  value={filters.category}
                  onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
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
              <label className={classes.searchLabel}>
                <span>Поиск</span>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="Поиск по названию или ID"
                  className={classes.searchInput}
                />
              </label>
            </div>

            <div className={classes.filterActions}>
              <Button onClick={fetchTypes}>Применить</Button>
              <Button variant="secondary" onClick={handleReset} icon={<FaRedo />}>
                Сбросить
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={classes.typesGrid}>
        {types.length === 0 ? (
          <div className={classes.empty}>
            <h3>Типы не найдены</h3>
            <p>Создайте первый тип задачи</p>
          </div>
        ) : (
          types.map(type => (
            <TypeCard
              key={type._id}
              type={type}
              onEdit={(type) => console.log('Edit:', type)}
              onDelete={handleDelete}
              onToggleStatus={handleToggleStatus}
            />
          ))
        )}
      </div>

      <CreateTypeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};

export default TypesPage;
