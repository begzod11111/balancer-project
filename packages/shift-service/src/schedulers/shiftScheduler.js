import * as cron from "node-cron";
import moment from "moment-timezone";
import { models } from "../models/db.js";
import assigneePoolService from "../services/assigneePoolService.js";
import {
  sendShiftCreatedEvent,
  sendShiftExpiredEvent,
} from "../producers/shift.producer.js";

class ShiftScheduler {
  constructor() {
    this.TIMEZONE = "Asia/Tashkent";
    this.CHECK_INTERVAL = "*/10 * * * *";
    this.EXPIRATION_THRESHOLD = 15 * 60;
    this.jobs = [];
  }

  async checkAndUpdateAssigneePool() {
    try {
      console.log('[ShiftScheduler] Начинаем проверку расписаний сотрудников...');

      const now = moment().tz(this.TIMEZONE);
      const currentDayOfWeek = now.day();

      const activeShifts = await models.Shift
        .find({
          isActive: true,
          deleted: false
        })
        .populate('department')
        .lean();

      const stats = {
        checked: 0,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        kafkaEvents: 0
      };

      for (const shift of activeShifts) {
        stats.checked++;

        try {
          const result = await this._processShift(shift, now, currentDayOfWeek);

          if (result.added) {
            stats.added++;
            stats.kafkaEvents++;
          } else if (result.updated) {
            stats.updated++;} else {
            stats.skipped++;}
        } catch (error) {
          stats.errors++;
          console.error(`[ShiftScheduler] Ошибка обработки смены ${shift.assigneeName}:`, error.message);
        }
      }

      console.log(`[ShiftScheduler] ✅ Проверка завершена:`, stats);

      return stats;
    } catch (error) {
      console.error('[ShiftScheduler] ❌ Критическая ошибка при проверке расписаний:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async checkAndRemoveExpiringShifts() {
    try {
      console.log('[ShiftScheduler] Начинаем проверку истекающих смен...');

      const departments = await models.Department.find({ deleted: false }).lean();

      const stats = {
        checked: 0,
        removed: 0,
        errors: 0,
        kafkaEvents: 0
      };

      for (const department of departments) {
        try {
          const assignees = await assigneePoolService.getAllAssigneesInDepartment(department.jiraId);

          stats.checked += assignees.length;

          for (const assignee of assignees) {
            const { accountId, remainingTTL, assigneeName, assigneeEmail } = assignee;

            if (remainingTTL > 0 && remainingTTL <= this.EXPIRATION_THRESHOLD) {
              console.log(`[ShiftScheduler] ⚠️ Смена ${assigneeName} истекает через ${Math.floor(remainingTTL / 60)} мин`);

              // Удаляем из пула
              await assigneePoolService.removeAssignee(department.jiraId, accountId);
              stats.removed++;

              // Отправляем событие в Kafka
              await sendShiftExpiredEvent({
                accountId,
                assigneeName,
                assigneeEmail,
                department: department.name,
                departmentJiraId: department.jiraId,
                remainingTTL,
                expiredAt: moment().tz(this.TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
              });
              stats.kafkaEvents++;

              console.log(`[ShiftScheduler] ✅ Смена ${assigneeName} удалена, событие отправлено в Kafka`);
            }
          }
        } catch (error) {
          stats.errors++;
          console.error(`[ShiftScheduler] Ошибка проверки отдела ${department.name}:`, error.message);
        }
      }

      console.log(`[ShiftScheduler] ✅ Проверка истекающих смен завершена:`, stats);

      return stats;
    } catch (error) {
      console.error('[ShiftScheduler] ❌ Критическая ошибка при проверке истекающих смен:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async _processShift(shift, currentTime, currentDayOfWeek) {
    const todayShift = shift.shifts[currentDayOfWeek];

    if (!todayShift || !todayShift.startTime || !todayShift.endTime) {
      return { skipped: true, reason: 'no_shift_today' };
    }

    if (!shift.department?.jiraId) {
      console.warn(`[ShiftScheduler] У сотрудника ${shift.assigneeName} нет jiraId отдела`);
      return { skipped: true, reason: 'no_department' };
    }

    const { isActive, ttlSeconds, shiftStart, shiftEnd } = this._calculateShiftStatus(
      todayShift.startTime,
      todayShift.endTime,
      currentTime
    );

    if (!isActive) {
      return { skipped: true, reason: 'shift_not_active' };
    }

    if (ttlSeconds <= 0) {
      return { skipped: true, reason: 'shift_expired' };
    }

    const metadata = this._buildMetadata(shift, todayShift, currentDayOfWeek, currentTime);

    const result = await this._addOrUpdateInPool(
      shift.department.jiraId,
      shift.accountId,
      ttlSeconds,
      metadata,
      shift.assigneeName
    );

    return result;
  }

  _calculateShiftStatus(startTime, endTime, currentTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const shiftStart = moment()
      .tz(this.TIMEZONE)
      .hour(startHour)
      .minute(startMinute)
      .second(0);

    const shiftEnd = moment()
      .tz(this.TIMEZONE)
      .hour(endHour)
      .minute(endMinute)
      .second(0);

    if (endHour < startHour) {
      shiftEnd.add(1, 'day');
    }

    const now = currentTime;
    const isActive = now.isSameOrAfter(shiftStart) && now.isBefore(shiftEnd);
    const ttlSeconds = Math.max(0, Math.floor((shiftEnd - now) / 1000));

    return {
      isActive,
      ttlSeconds,
      shiftStart: shiftStart.format('HH:mm'),
      shiftEnd: shiftEnd.format('HH:mm')
    };
  }

  _buildMetadata(shift, todayShift, dayOfWeek, currentTime) {
    return {
      assigneeName: shift.assigneeName,
      assigneeEmail: shift.assigneeEmail,
      shiftStart: todayShift.startTime,
      shiftEnd: todayShift.endTime,
      dayOfWeek,
      date: currentTime.format('YYYY-MM-DD'),
      addedBy: 'scheduler',
      limits: shift.limits || {},
      departmentId: shift.department._id
    };
  }

  async _addOrUpdateInPool(departmentJiraId, accountId, ttlSeconds, metadata, assigneeName) {
    const isInPool = await assigneePoolService.hasAssignee(departmentJiraId, accountId);

    if (isInPool) {
      await assigneePoolService.updateAssigneeTTL(
        departmentJiraId,
        accountId,
        ttlSeconds,
        metadata
      );console.log(`[ShiftScheduler] ✅ Обновлен TTL для ${assigneeName} на ${Math.floor(ttlSeconds / 60)} мин`);
      return { updated: true };
    } else {
      await assigneePoolService.addAssignee(
        departmentJiraId,
        accountId,
        ttlSeconds,
        metadata
      );

      // Отправляем событие в Kafka при добавлении нового сотрудника
      await sendShiftCreatedEvent({
        accountId,
        assigneeName: metadata.assigneeName,
        assigneeEmail: metadata.assigneeEmail,
        department: departmentJiraId,
        shiftStart: metadata.shiftStart,
        shiftEnd: metadata.shiftEnd,
        ttlSeconds,
        date: metadata.date,
        addedAt: moment().tz(this.TIMEZONE).format('YYYY-MM-DD HH:mm:ss')
      });

      console.log(`[ShiftScheduler] ✅ Добавлен ${assigneeName} в пул на ${Math.floor(ttlSeconds / 60)} мин, событие отправлено в Kafka`);
      return { added: true };
    }
  }

  start() {
    console.log(`[ShiftScheduler] 🚀 Запуск планировщика (проверка каждые 10 минут)`);

    this.checkAndUpdateAssigneePool().catch(error => {
      console.error('[ShiftScheduler] Ошибка при первой проверке расписаний:', error);
    });

    this.checkAndRemoveExpiringShifts().catch(error => {
      console.error('[ShiftScheduler] Ошибка при первой проверке истекающих смен:', error);
    });

    const updateJob = cron.schedule(
      this.CHECK_INTERVAL,
      async () => {
        console.log(`[ShiftScheduler] ⏰ Плановая проверка расписаний: ${moment().tz(this.TIMEZONE).format('DD.MM.YYYY HH:mm')}`);
        await this.checkAndUpdateAssigneePool();
      },
      {
        timezone: this.TIMEZONE,
        scheduled: true
      }
    );

    const cleanupJob = cron.schedule(
      this.CHECK_INTERVAL,
      async () => {
        console.log(`[ShiftScheduler] ⏰ Плановая проверка истекающих смен: ${moment().tz(this.TIMEZONE).format('DD.MM.YYYY HH:mm')}`);
        await this.checkAndRemoveExpiringShifts();
      },
      {
        timezone: this.TIMEZONE,
        scheduled: true
      }
    );

    this.jobs.push(updateJob, cleanupJob);
    console.log('[ShiftScheduler] ✅ Планировщик успешно запущен (2 задачи)');
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('[ShiftScheduler] ⏹️ Планировщик остановлен');
  }

  getStatus() {
    return {
      isRunning: this.jobs.length > 0,
      activeJobs: this.jobs.length,
      interval: this.CHECK_INTERVAL,
      expirationThreshold: `${this.EXPIRATION_THRESHOLD / 60} минут`,
      timezone: this.TIMEZONE,
      nextRun: this.jobs[0] ? moment().tz(this.TIMEZONE).add(10, 'minutes').format('DD.MM.YYYY HH:mm') : null
    };
  }
}

export default new ShiftScheduler();
