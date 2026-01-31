// packages/analytics-service/src/services/issueService.js

import {models} from "../models/db.js";

class IssueService {



    // Получить все задачи с фильтрацией
    async getIssues(filters = {}) {
        const query = {};

        if (filters.typeId) query.typeId = filters.typeId;
        if (filters.status) query.status = filters.status;
        if (filters.issueStatusId) query.issueStatusId = filters.issueStatusId;
        if (filters.assigneeAccountId) query.assigneeAccountId = filters.assigneeAccountId;
        if (filters.assignmentGroupId) query.assignmentGroupId = filters.assignmentGroupId;

        if (filters.dateFrom || filters.dateTo) {
            query.createdAt = {};
            if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
        }

        return models.Issue.find(query)
            .sort({createdAt: -1})
            .limit(filters.limit || 100);
    }

    // Статистика по типам задач
    async getStatsByType(filters = {}) {
        const match = {};
        if (filters.assignmentGroupId) match.assignmentGroupId = filters.assignmentGroupId;
        if (filters.dateFrom || filters.dateTo) {
            match.createdAt = {};
            if (filters.dateFrom) match.createdAt.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) match.createdAt.$lte = new Date(filters.dateTo);
        }

        return models.Issue.aggregate([
            {$match: match},
            {
                $group: {
                    _id: '$typeId',
                    count: {$sum: 1},
                    openCount: {
                        $sum: {$cond: [{$eq: ['$status', 'open']}, 1, 0]}
                    },
                    closedCount: {
                        $sum: {$cond: [{$eq: ['$status', 'closed']}, 1, 0]}
                    }
                }
            },
            {$sort: {count: -1}}
        ]);
    }

    // Статистика по статусам
    async getStatsByStatus(filters = {}) {
        const match = {};
        if (filters.typeId) match.typeId = filters.typeId;
        if (filters.assignmentGroupId) match.assignmentGroupId = filters.assignmentGroupId;

        return models.Issue.aggregate([
            {$match: match},
            {
                $group: {
                    _id: '$issueStatusId',
                    count: {$sum: 1}
                }
            },
            {$sort: {count: -1}}
        ]);
    }

    // Статистика по исполнителям
    async getStatsByAssignee(filters = {}) {
        const match = {assigneeAccountId: {$ne: null}};
        if (filters.assignmentGroupId) match.assignmentGroupId = filters.assignmentGroupId;
        if (filters.typeId) match.typeId = filters.typeId;

        return models.Issue.aggregate([
            {$match: match},
            {
                $group: {
                    _id: '$assigneeAccountId',
                    totalIssues: {$sum: 1},
                    openIssues: {
                        $sum: {$cond: [{$eq: ['$status', 'open']}, 1, 0]}
                    },
                    closedIssues: {
                        $sum: {$cond: [{$eq: ['$status', 'closed']}, 1, 0]}
                    }
                }
            },
            {$sort: {totalIssues: -1}}
        ]);
    }

    // Статистика по группам назначения
    async getStatsByGroup(filters = {}) {
        const match = {};
        if (filters.typeId) match.typeId = filters.typeId;
        if (filters.dateFrom || filters.dateTo) {
            match.createdAt = {};
            if (filters.dateFrom) match.createdAt.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) match.createdAt.$lte = new Date(filters.dateTo);
        }

        return models.Issue.aggregate([
            {$match: match},
            {
                $group: {
                    _id: '$assignmentGroupId',
                    totalIssues: {$sum: 1},
                    assignedIssues: {
                        $sum: {$cond: [{$ne: ['$assigneeAccountId', null]}, 1, 0]}
                    },
                    unassignedIssues: {
                        $sum: {$cond: [{$eq: ['$assigneeAccountId', null]}, 1, 0]}
                    }
                }
            },
            {$sort: {totalIssues: -1}}
        ]);
    }

    // Временная статистика (по дням/неделям/месяцам)
    async getTimeSeriesStats(groupBy = 'day', filters = {}) {
        const match = {};
        if (filters.typeId) match.typeId = filters.typeId;
        if (filters.assignmentGroupId) match.assignmentGroupId = filters.assignmentGroupId;
        if (filters.dateFrom || filters.dateTo) {
            match.createdAt = {};
            if (filters.dateFrom) match.createdAt.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) match.createdAt.$lte = new Date(filters.dateTo);
        }

        const dateFormat = {
            day: {$dateToString: {format: '%Y-%m-%d', date: '$createdAt'}},
            week: {$dateToString: {format: '%Y-W%V', date: '$createdAt'}},
            month: {$dateToString: {format: '%Y-%m', date: '$createdAt'}}
        };

        return models.Issue.aggregate([
            {$match: match},
            {
                $group: {
                    _id: dateFormat[groupBy] || dateFormat.day,
                    count: {$sum: 1}
                }
            },
            {$sort: {_id: 1}}
        ]);
    }

    // Поиск задач по ключу или ID
    async searchIssues(searchTerm) {
        return models.Issue.find({
            $or: [
                {issueKey: new RegExp(searchTerm, 'i')},
                {issueId: new RegExp(searchTerm, 'i')}
            ]
        }).limit(50);
    }

    // Получить нагрузку на исполнителей
    async getAssigneeLoad(assignmentGroupId) {
        return models.Issue.aggregate([
            {
                $match: {
                    assignmentGroupId,
                    status: 'open',
                    assigneeAccountId: {$ne: null}
                }
            },
            {
                $group: {
                    _id: '$assigneeAccountId',
                    activeIssues: {$sum: 1}
                }
            },
            {$sort: {activeIssues: -1}}
        ]);
    }

// Обновление статуса задачи
    async updateIssueStatus(issueId, newStatus, newStatusId) {
        const issue = await models.Issue.findOne({issueId});

        if (!issue) {
            throw new Error('Issue not found');
        }

        return models.Issue.findOneAndUpdate(
            {issueId},
            {
                $set: {
                    status: newStatus,
                    issueStatusId: newStatusId,
                    updatedAt: new Date()
                }
            },
            {new: true}
        );
    }

// Обновление исполнителя задачи
    async updateIssueAssignee(issueId, newAssigneeAccountId) {
        const issue = await models.Issue.findOne({issueId});

        if (!issue) {
            throw new Error('Issue not found');
        }

        return models.Issue.findOneAndUpdate(
            {issueId},
            {
                $set: {
                    assigneeAccountId: newAssigneeAccountId,
                    updatedAt: new Date()
                }
            },
            {new: true}
        );
    }

// Массовое обновление статусов
    async bulkUpdateStatus(issueIds, newStatus, newStatusId) {
        return models.Issue.updateMany(
            {issueId: {$in: issueIds}},
            {
                $set: {
                    status: newStatus,
                    issueStatusId: newStatusId,
                    updatedAt: new Date()
                }
            }
        );
    }

// Переназначение задач с одного исполнителя на другого
    async reassignIssues(fromAssigneeId, toAssigneeId, filters = {}) {
        const query = {
            assigneeAccountId: fromAssigneeId,
        };

        if (filters.assignmentGroupId) {
            query.assignmentGroupId = filters.assignmentGroupId;
        }

        return models.Issue.updateMany(
            query,
            {
                $set: {
                    assigneeAccountId: toAssigneeId,
                    updatedAt: new Date()
                }
            }
        );
    }

    async createIssue(issueData) {
        const existingIssue = await models.Issue.findOne({issueId: issueData.issueId});
        if (existingIssue) {
            return existingIssue;
        }

        const newIssue = new models.Issue({
            issueId: issueData.issueId,
            issueKey: issueData.issueKey,
            typeId: issueData.typeId,
            status: issueData.status,
            issueStatusId: issueData.issueStatusId,
            assigneeAccountId: issueData.assigneeAccountId,
            assignmentGroupId: issueData.assignmentGroupId,
            createdAt: issueData.createdAt || new Date(),
            updatedAt: issueData.updatedAt || new Date()
        });

        return newIssue.save();
    }


    // Общая статистика
    async getOverallStats(filters = {}) {
        const match = {};
        if (filters.assignmentGroupId) match.assignmentGroupId = filters.assignmentGroupId;

        const stats = await models.Issue.aggregate([
            {$match: match},
            {
                $group: {
                    _id: null,
                    total: {$sum: 1},
                    open: {$sum: {$cond: [{$eq: ['$status', 'open']}, 1, 0]}},
                    closed: {$sum: {$cond: [{$eq: ['$status', 'closed']}, 1, 0]}},
                    assigned: {$sum: {$cond: [{$ne: ['$assigneeAccountId', null]}, 1, 0]}},
                    unassigned: {$sum: {$cond: [{$eq: ['$assigneeAccountId', null]}, 1, 0]}}
                }
            }
        ]);

        return stats[0] || {total: 0, open: 0, closed: 0, assigned: 0, unassigned: 0};
    }
}

export default new IssueService();
