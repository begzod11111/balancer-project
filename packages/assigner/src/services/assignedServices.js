import redisServices from "./redisServices.js";
import PriorityQueue from 'js-priority-queue';
import jiraServices from "./jiraServices.js";

class AssignedServices {


    async assignedIssue(issueKey, departmentObjectId) {
        if (!issueKey || !departmentObjectId) {
            console.warn('[AssignedServices] ❌ Недостаточно данных для назначения issue');
            return;
        }
        try {
            const assignees = await redisServices.getShiftsByDepartment(departmentObjectId);
            if (!assignees || assignees.length === 0) {
                console.warn(`[AssignedServices] ❌ Нет данных о сменах для департамента ${departmentObjectId}`);
                return;
            }
            const optimalAssignee = this.selectLeastLoadedAssignee(assignees);
            await jiraServices.assignIssue(issueKey, optimalAssignee);
        } catch (error) {
            console.error('[AssignedServices] ❌ Ошибка при обработке issue:', error);
            throw error;
        }
    }
  /**
   * Выбирает наименее загруженного сотрудника из массива
   * @param {Array} assignees - массив сотрудников с метриками
   * @returns {string|null} accountId наименее загруженного сотрудника
   */
  selectLeastLoadedAssignee(assignees) {
    if (!assignees || assignees.length === 0) {
      console.warn('[AssignedServices] Нет доступных сотрудников');
      return null;
    }

    // Фильтруем активных сотрудников с доступной нагрузкой
    const available = assignees.filter(a => {
      const { metrics, limits } = a;
      return (
        metrics.activeTasksCount < limits.maxActiveIssues &&
        metrics.todayTasksCount < limits.maxDailyIssues
      );
    });

    if (available.length === 0) {
      console.warn('[AssignedServices] Все сотрудники достигли лимита');
      return null;
    }

    // Создаем очередь приоритетов (минимальный вес = высший приоритет)
    const queue = new PriorityQueue({
      comparator: (a, b) => a.load - b.load
    });

    available.forEach(assignee => {
      queue.queue({
        accountId: assignee.accountId,
        name: assignee.assigneeName,
        load: assignee.calculatedWeight
      });
    });

    const selected = queue.dequeue();
    console.log(`[AssignedServices] ✅ Выбран: ${selected.name} (вес: ${selected.load})`);

    return selected.accountId;
  }

  /**
   * Выбирает несколько наименее загруженных сотрудников
   * @param {Array} assignees - массив сотрудников
   * @param {number} count - количество для выбора
   * @returns {Array<string>} массив accountId
   */
  selectMultipleLeastLoaded(assignees, count = 1) {
    const selected = [];
    const pool = [...assignees];

    for (let i = 0; i < count; i++) {
      const accountId = this.selectLeastLoadedAssignee(pool);
      if (!accountId) break;

      selected.push(accountId);
      const idx = pool.findIndex(a => a.accountId === accountId);
      if (idx !== -1) pool.splice(idx, 1);
    }

    return selected;
  }
}

export default new AssignedServices();
