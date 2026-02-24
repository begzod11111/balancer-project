const BASE_URL = 'https://tamada.monitoring-jira.uz'



export const URLS = {
    // ========== AUTH SERVICE ==========
    LOGIN: `${BASE_URL}/api/guard-auth/auth/login`,
    REFRESH_TOKEN: `${BASE_URL}/api/guard-auth/auth/refresh-token`,
    VERIFY_TOKEN: `${BASE_URL}/api/guard-auth/auth/verify-token`,
    VERIFY_AUTH: `${BASE_URL}/api/guard-auth/auth/verify-auth`,
    LOGOUT: `${BASE_URL}/api/guard-auth/auth/logout`,
    ME: `${BASE_URL}/api/guard-auth/auth/me`,

    // ========== WORK SCHEDULES ==========
    GET_WORK_SCHEDULES: `${BASE_URL}/api/shift-service/shift`,
    GET_WORK_SCHEDULE_BY_ID: (scheduleId) => `${BASE_URL}/api/shift-service/shift/${scheduleId}`,
    GET_WORK_SCHEDULE_BY_ASSIGNEE_ID: (assigneeId) => `${BASE_URL}/api/shift-service/shift/assignee/${assigneeId}`,
    GET_WORK_SCHEDULE_BY_ACCOUNT_ID: (accountId) => `${BASE_URL}/api/shift-service/shift/account/${accountId}`,
    GET_WORK_SCHEDULE_BY_DEPARTMENT_ID: (departmentId) => `${BASE_URL}/api/shift-service/shift/department/${departmentId}`,
    GET_WORKING_ASSIGNEES_FOR_DAY: (dayOfWeek) => `${BASE_URL}/api/shift-service/shift/day/${dayOfWeek}`,
    CREATE_WORK_SCHEDULE: `${BASE_URL}/api/shift-service/shift`,
    UPDATE_WORK_SCHEDULE: (scheduleId) => `${BASE_URL}/api/shift-service/shift/${scheduleId}`,
    UPDATE_SHIFT_FOR_DAY: (scheduleId, dayOfWeek) => `${BASE_URL}/api/shift-service/shift/${scheduleId}/shift/${dayOfWeek}`,
    UPDATE_SCHEDULE_LIMITS: (scheduleId) => `${BASE_URL}/api/shift-service/shift/${scheduleId}/limits`,
    CHANGE_ACTIVE_STATUS: (scheduleId) => `${BASE_URL}/api/shift-service/shift/${scheduleId}/active`,
    DELETE_WORK_SCHEDULE: (scheduleId) => `${BASE_URL}/api/shift-service/shift/${scheduleId}`,

    // ========== DEPARTMENTS ==========
    // Получение департаментов
    GET_DEPARTMENTS: `${BASE_URL}/api/shift-service/department`,
    GET_ACTIVE_DEPARTMENTS: `${BASE_URL}/api/shift-service/department/active`,
    GET_DEPARTMENTS_STATS: `${BASE_URL}/api/shift-service/department/stats`,
    GET_DEPARTMENT_BY_ID: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}`,
    GET_DEPARTMENT_BY_OBJECT_ID: (objectId) => `${BASE_URL}/api/shift-service/department/object-id/${objectId}`,
    GET_DEPARTMENT_BY_NAME: (name) => `${BASE_URL}/api/shift-service/department/name/${encodeURIComponent(name)}`,
    CHECK_DEPARTMENT_EXISTS: (identifier) => `${BASE_URL}/api/shift-service/department/check/${identifier}`,

    // CRUD операции департаментов
    CREATE_DEPARTMENT: `${BASE_URL}/api/shift-service/department`,
    UPDATE_DEPARTMENT: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}`,
    TOGGLE_DEPARTMENT_STATUS: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}/active`,
    DELETE_DEPARTMENT: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}`,
    RESTORE_DEPARTMENT: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}/restore`,
    PERMANENT_DELETE_DEPARTMENT: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}/permanent`,

    // Управление весами типов задач
    GET_DEPARTMENT_WEIGHTS: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}/weights`,
    SET_TYPE_WEIGHT: (departmentId, typeId) => `${BASE_URL}/api/shift-service/department/${departmentId}/weights/${typeId}`,
    SET_STATUS_WEIGHT: (departmentId, typeId, statusId) => `${BASE_URL}/api/shift-service/department/${departmentId}/weights/${typeId}/statuses/${statusId}`,
    REMOVE_TYPE_WEIGHT: (departmentId, typeId) => `${BASE_URL}/api/shift-service/department/${departmentId}/weights/${typeId}`,
    REMOVE_STATUS_WEIGHT: (departmentId, typeId, statusId) => `${BASE_URL}/api/shift-service/department/${departmentId}/weights/${typeId}/statuses/${statusId}`,
    // Управление формулой расчёта нагрузки
    UPDATE_LOAD_FORMULA: (departmentId) => `${BASE_URL}/api/shift-service/department/${departmentId}/formula`,

    // ========== ANALYTICS SERVICE (TYPES) ==========
    // Получение типов
    GET_ALL_TYPES: `${BASE_URL}/api/analytics/type`,
    GET_ACTIVE_TYPES: `${BASE_URL}/api/analytics/type/active`,
    GET_TYPES_STATS: `${BASE_URL}/api/analytics/type/stats`,
    GET_TYPES_BY_CATEGORY: (category) => `${BASE_URL}/api/analytics/type/category/${category}`,
    GET_TYPE_BY_ID: (typeId) => `${BASE_URL}/api/analytics/type/${typeId}`,
    GET_TYPE_BY_TYPE_ID: (typeId) => `${BASE_URL}/api/analytics/type/type-id/${typeId}`,
    CHECK_TYPE_EXISTS: (identifier) => `${BASE_URL}/api/analytics/type/check/${identifier}`,

    // CRUD операции типов
    CREATE_TYPE: `${BASE_URL}/api/analytics/type`,
    SYNC_TYPES_FROM_JIRA: `${BASE_URL}/api/analytics/type/sync-jira`,
    UPDATE_TYPE: (typeId) => `${BASE_URL}/api/analytics/type/${typeId}`,
    UPDATE_WEIGHTED_STATUS: (typeId, statusId) => `${BASE_URL}/api/analytics/type/${typeId}/status/${statusId}`,
    TOGGLE_TYPE_STATUS: (typeId) => `${BASE_URL}/api/analytics/type/${typeId}/active`,
    DELETE_TYPE: (typeId) => `${BASE_URL}/api/analytics/type/${typeId}`,
    RESTORE_TYPE: (typeId) => `${BASE_URL}/api/analytics/type/${typeId}/restore`,
    PERMANENT_DELETE_TYPE: (typeId) => `${BASE_URL}/api/analytics/type/${typeId}/permanent`,
    UPDATE_TYPE_STATUSES: (id) => `${BASE_URL}/api/analytics/type/${id}/statuses`,
    SYNC_TYPE_STATUSES: (id) => `${BASE_URL}/api/analytics/type/${id}/statuses/sync`,
    VALIDATE_TYPE_STATUSES: (id) => `${BASE_URL}/api/analytics/type/${id}/statuses/validate`,

    // ========== GATEWAY HEALTH ==========
    GATEWAY_HEALTH: `${BASE_URL}/health`,


    // ========== REDIS SHIFTS (cached shifts) ==========
    GET_REDIS_SHIFT: (departmentObjectId, accountId, assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool.${departmentObjectId}/${accountId}/${encodeURIComponent(assigneeEmail)}`,
    GET_REDIS_SHIFTS_BY_DEPARTMENT: (departmentObjectId) =>
        `${BASE_URL}/api/shift-service/pool/department/${departmentObjectId}`,
    GET_REDIS_SHIFTS_BY_ACCOUNT: (accountId) =>
        `${BASE_URL}/api/shift-service/pool/account/${accountId}`,
    GET_REDIS_SHIFTS_BY_EMAIL: (assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool/email/${encodeURIComponent(assigneeEmail)}`,
    INCREMENT_REDIS_SHIFT: (departmentObjectId, accountId, assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool/${departmentObjectId}/${accountId}/${encodeURIComponent(assigneeEmail)}/increment`,
    DELETE_REDIS_SHIFT: (departmentObjectId, accountId, assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool/${departmentObjectId}/${accountId}/${encodeURIComponent(assigneeEmail)}`,
    DELETE_REDIS_SHIFTS_BY_DEPARTMENT: (departmentObjectId) =>
        `${BASE_URL}/api/shift-service/pool/department/${departmentObjectId}`,
    GET_REDIS_SHIFT_TTL: (departmentObjectId, accountId, assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool/${departmentObjectId}/${accountId}/${encodeURIComponent(assigneeEmail)}/ttl`,
    UPDATE_REDIS_SHIFT_TTL: (departmentObjectId, accountId, assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool/${departmentObjectId}/${accountId}/${encodeURIComponent(assigneeEmail)}/ttl`,
    CHECK_REDIS_SHIFT_EXISTS: (departmentObjectId, accountId, assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool/${departmentObjectId}/${accountId}/${encodeURIComponent(assigneeEmail)}/exists`,
    UPDATE_REDIS_SHIFT_LIMITS: (departmentObjectId, accountId, assigneeEmail) =>
        `${BASE_URL}/api/shift-service/pool/${departmentObjectId}/${accountId}/${encodeURIComponent(assigneeEmail)}/limits`,
    GET_REDIS_SHIFTS_STATS: `${BASE_URL}/api/shift-service/pool/stats/all`,
    GET_ALL_REDIS_SHIFTS: `${BASE_URL}/api/shift-service/pool/all`,
    CREATE_REDIS_SHIFT: `${BASE_URL}/api/shift-service/pool`,


    // ========== CRM SERVICE (ISSUES) ==========
    GET_ISSUES: `${BASE_URL}/api/analytics/issues`,
    GET_ISSUE_BY_ID: (issueId) => `${BASE_URL}/api/analytics/issues/${issueId}`,
    GET_ISSUES_STATS: `${BASE_URL}/api/analytics/issues/stats`,
    GET_ISSUES_STATS_BY_TYPE: `${BASE_URL}/api/analytics/issues/stats/by-type`,
    GET_ISSUES_STATS_BY_STATUS: `${BASE_URL}/api/analytics/issues/stats/by-status`,
    GET_ISSUES_STATS_BY_ASSIGNEE: `${BASE_URL}/api/analytics/issues/stats/by-assignee`,
    GET_ISSUES_STATS_BY_GROUP: `${BASE_URL}/api/analytics/issues/stats/by-group`,

   // ========== CHANGELOG SERVICE ==========
// Сохранение
    SAVE_CHANGELOG: `${BASE_URL}/api/analytics/changelog/save`,
    SAVE_BULK_CHANGELOGS: `${BASE_URL}/api/analytics/changelog/bulk`,

// Новая система поиска (миллисекунды)
    SEARCH_CHANGELOGS: `${BASE_URL}/api/analytics/changelog/search`,
    GET_ALL_CHANGELOGS: `${BASE_URL}/api/analytics/changelog/all`,
    COUNT_CHANGELOGS: `${BASE_URL}/api/analytics/changelog/count`,
    GET_CHANGELOG_STATS: `${BASE_URL}/api/analytics/changelog/stats`,

// Активность (миллисекунды)
    GET_EMPLOYEE_ACTIVITY: (accountId) => `${BASE_URL}/api/analytics/changelog/employee-activity/${accountId}`,
    GET_DEPARTMENT_ACTIVITY: (departmentId) => `${BASE_URL}/api/analytics/changelog/department-activity/${departmentId}`,
    GET_TEAM_ACTIVITY: `${BASE_URL}/api/analytics/changelog/team-activity`,

// Старые методы (совместимость)
    GET_CHANGELOG_BY_ISSUE: (issueId) => `${BASE_URL}/api/analytics/changelog/issue/${issueId}`,
    GET_ASSIGNMENT_HISTORY: (issueId) => `${BASE_URL}/api/analytics/changelog/assignment-history/${issueId}`,
    GET_STATUS_HISTORY: (issueId) => `${BASE_URL}/api/analytics/changelog/status-history/${issueId}`,
    GET_HISTORY_BY_EVENT_TYPE: (issueId, eventType) => `${BASE_URL}/api/analytics/changelog/event-type/${issueId}/${eventType}`,
    GET_ASSIGNMENT_MATRIX: `${BASE_URL}/api/analytics/changelog/assignment-matrix`


};
