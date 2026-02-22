// packages/crm/src/pages/IssuesPage/IssuesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { FaTicketAlt, FaFilter, FaRedo, FaSearch, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import Select from '../../components/Select/Select';
import Button from '../../components/Button/Button';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import classes from './IssuesPage.module.css';
import IssueCard from "../../components/IssueCard/IssueCard";

const IssuesPage = () => {
  const { showLoader, hideLoader } = useLoader();
  const { notify } = useNotification();

  const [issues, setIssues] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [types, setTypes] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    status: null,
    assigneeAccountId: null,
    assignmentGroupId: null,
    typeId: null,
    issueStatusId: null,
    limit: 20,
    skip: 0,
    sort: 'createdAt'
  });

  const fetchDepartments = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_DEPARTMENTS, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Ошибка загрузки отделов:', error);
      notify.error('Не удалось загрузить отделы');
    }
  }, [notify]);

  const fetchTypes = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_ALL_TYPES, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTypes(response.data.data || []);
    } catch (error) {
      console.error('Ошибка загрузки типов:', error);
      notify.error('Не удалось загрузить типы');
    }
  }, [notify]);

  const fetchShifts = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(URLS.GET_WORK_SCHEDULES, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShifts(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки сотрудников:', error);
      notify.error('Не удалось загрузить сотрудников');
    }
  }, [notify]);

  const fetchIssues = useCallback(async () => {
    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const params = { ...filters };

      const response = await axios.get(URLS.GET_ISSUES, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
        console.log(response.data)
      setIssues(response.data.data || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Ошибка загрузки issues:', error);
      notify.error('Не удалось загрузить заявки');
    } finally {
      hideLoader();
    }
  }, [filters, showLoader, hideLoader, notify]);

  useEffect(() => {
    fetchDepartments();
    fetchTypes();
    fetchShifts();}, [fetchDepartments, fetchTypes, fetchShifts]);

  useEffect(() => {
    fetchIssues();
  }, []);

  const getDepartmentName = (jiraId) => {
    const dept = departments.find(d => d.jiraId === jiraId);
    return dept?.name || jiraId;
  };

  const getTypeName = (typeId) => {
    const type = types.find(t => t.typeId === typeId);
    return type?.name || typeId;
  };

  const getStatusName = (typeId, statusId) => {
    const type = types.find(t => t.typeId === typeId);
    const status = type?.statuses?.find(s => s.id === statusId);
    return status?.name || statusId;
  };

  const getAssigneeName = (accountId) => {
    if (!accountId) return 'Не назначено';
    const shift = shifts.find(s => s.accountId === accountId);
    return shift?.assigneeName || accountId;
  };

  const searchFilters = () => {
    setFilters(prev => ({ ...prev, skip: 0 }))
      fetchIssues()
  }

  const getStatusClass = (status) => {
    const lowerStatus = status?.toLowerCase() || '';
    if (lowerStatus.includes('открыто') || lowerStatus.includes('new')) return 'created';
    if (lowerStatus.includes('progress') || lowerStatus.includes('active')) return 'inProgress';
    if (lowerStatus.includes('done') || lowerStatus.includes('completed')) return 'completed';
    if (lowerStatus.includes('closed') || lowerStatus.includes('resolved')) return 'completed';
    if (lowerStatus.includes('created - L1.5') || lowerStatus.includes('reopened')) return 'created';
    return 'created';
  };

  const handleReset = () => {
    setFilters({
      status: null,
      assigneeAccountId: null,
      assignmentGroupId: null,
      typeId: null,
      issueStatusId: null,
      limit: 20,
      skip: 0,
      sort: 'createdAt'
    });
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    const newSkip = (newPage - 1) * filters.limit;
    setFilters(prev => ({ ...prev, skip: newSkip }));
    setCurrentPage(newPage);
  };

  const departmentOptions = [
    { value: null, label: 'Все отделы' },
    ...departments.map(d => ({ value: d.jiraId, label: d.name }))
  ];

  const typeOptions = [
    { value: null, label: 'Все типы' },
    ...types.map(t => ({ value: t.typeId, label: t.name }))
  ];

  const assigneeOptions = [
    { value: null, label: 'Все исполнители' },
    ...shifts.map(s => ({ value: s.accountId, label: s.assigneeName }))
  ];

  const sortOptions = [
    { value: 'createdAt', label: 'По дате создания (новые)' },
    { value: '-createdAt', label: 'По дате создания (старые)' },
    { value: 'updatedAt', label: 'По обновлению (новые)' },
    { value: '-updatedAt', label: 'По обновлению (старые)' }
  ];

  const totalPages = Math.ceil(total / filters.limit);

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <div>
          <h1><FaTicketAlt /> Заявки Jira</h1>
          <p>Просмотр и фильтрация заявок из системы Jira</p>
        </div>
        <div className={classes.statsContainer}>
          <div className={classes.stat}>
            <span className={classes.statLabel}>Всего заявок</span>
            <span className={classes.statValue}>{total}</span>
          </div>
          <div className={classes.stat}>
            <span className={classes.statLabel}>На странице</span>
            <span className={classes.statValue}>{issues.length}</span>
          </div>
        </div>
      </header>

      <div className={classes.filterPanel}>
        <div className={classes.filterHeader}>
          <h3>Фильтры и поиск</h3>
          <Button
            variant="secondary"
            icon={<FaFilter />}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Скрыть' : 'Показать'} фильтры
          </Button>
        </div>

        {showFilters && (
          <div className={classes.advancedFilters}>
            <div className={classes.filterRow}>
              <label>
                <span>Отдел</span>
                <Select
                  options={departmentOptions}
                  value={filters.assignmentGroupId}
                  onChange={(value) => setFilters(prev => ({ ...prev, assignmentGroupId: value, skip: 0 }))}
                  placeholder="Выберите отдел"
                />
              </label>

              <label>
                <span>Тип заявки</span>
                <Select
                  options={typeOptions}
                  value={filters.typeId}
                  onChange={(value) => setFilters(prev => ({ ...prev, typeId: value, skip: 0 }))}
                  placeholder="Выберите тип"
                />
              </label>
            </div>

            <div className={classes.filterRow}>
              <label>
                <span>Исполнитель</span>
                <Select
                  options={assigneeOptions}
                  value={filters.assigneeAccountId}
                  onChange={(value) => setFilters(prev => ({ ...prev, assigneeAccountId: value, skip: 0 }))}
                  placeholder="Выберите исполнителя"
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
                <span>Статус заявки</span>
                <input
                  type="text"
                  value={filters.status || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, skip: 0 }))}
                  placeholder="Введите статус"
                  className={classes.filterInput}
                />
              </label>

              <label>
                <span>Записей на странице</span>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={filters.limit}
                  onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value, 10) || 20, skip: 0 }))}
                  className={classes.filterInput}
                />
              </label>
            </div>

            <div className={classes.filterActions}>
              <Button onClick={searchFilters} icon={<FaSearch />}>
                Применить
              </Button>
              <Button variant="secondary" onClick={handleReset} icon={<FaRedo />}>
                Сбросить
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={classes.list}>
        {issues.length === 0 ? (
          <div className={classes.empty}>
            <FaTicketAlt size={64} />
            <h3>Заявки не найдены</h3>
            <p>Попробуйте изменить параметры фильтрации или сбросить все фильтры</p>
          </div>
        ) : (
          issues.map(issue => (
            <IssueCard
              key={issue._id}
              issue={issue}
              departmentName={getDepartmentName(issue.assignmentGroupId)}
              typeName={getTypeName(issue.typeId)}
              statusName={getStatusName(issue.typeId, issue.issueStatusId)}
              statusClass={getStatusClass(issue.status)}
              assigneeName={getAssigneeName(issue.assigneeAccountId)}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className={classes.pagination}>
          <Button
            variant="secondary"
            icon={<FaChevronLeft />}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Назад
          </Button>

          <div className={classes.pageNumbers}>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  className={`${classes.pageButton} ${currentPage === pageNum ? classes.active : ''}`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <Button
            variant="secondary"
            icon={<FaChevronRight />}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Вперёд
          </Button>

          <span className={classes.pageInfo}>
            Страница {currentPage} из {totalPages}
          </span>
        </div>
      )}
    </div>
  );
};

export default IssuesPage;
