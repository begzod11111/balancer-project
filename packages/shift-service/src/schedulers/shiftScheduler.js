import * as cron from "node-cron";
import moment from "moment-timezone";
import { models } from "../models/db.js";
import assigneePoolService from "../services/assigneePoolService.js";
import {sendShiftCreatedEvent,
  sendShiftExpiredEvent,
  sendShiftUpdatedEvent,
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
            stats.updated++;
            stats.kafkaEvents++;
          } else {
            stats.skipped++;
          }
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
        const stats = {
            checked: 0,
            removed: 0,
            kafkaEvents: 0,
            errors: 0
        };
        try {
            console.log('[ShiftScheduler] Начинаем проверку истекающих смен...');

            const assignees = await assigneePoolService.getPoolAssignees();
            for (const index in assignees) {
                stats.checked++;
                const {accountId, remainingTTL, assigneeName, assigneeEmail, departmentObjectId, departmentId} = assignees[index];
                console.log(remainingTTL)

                if (
                    remainingTTL > 0 &&
                    remainingTTL <= this.EXPIRATION_THRESHOLD &&
                    departmentObjectId
                ) {
                    try {
                        await sendShiftExpiredEvent({
                            departmentId,
                            departmentObjectId,
                            accountId,
                            assigneeEmail,
                            assigneeName,
                            remainingTTL,
                            expiredAt: moment().tz(this.TIMEZONE).toISOString()
                        });

                        assigneePoolService.removeAssignee(departmentObjectId, accountId, assigneeEmail).catch(console.error);

                        stats.removed++;
                        stats.kafkaEvents++;
                        console.log(`[ShiftScheduler] ⏰ Отправлено событие истекающей смены ${assigneeName} (осталось ${remainingTTL}с)`);
                    } catch (err) {
                        stats.errors++;
                        console.error(`[ShiftScheduler] ❌ Ошибка отправки события shift_expired для ${assigneeName}:`, err.message);
                    }
                }
            }

            console.log(`[ShiftScheduler] ✅ Проверка истекающих смен завершена:`, stats);
            return stats;
        } catch (error) {
            stats.errors++;
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

    if (!shift.department?.ObjectId) {
      console.warn(`[ShiftScheduler] У сотрудника ${shift.assigneeName} нет ObjectId отдела`);
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

    if (ttlSeconds <= 2000) {
      return { skipped: true, reason: 'shift_expired' };
    }

    const result = await this._sendShiftEvent(
      shift.department.ObjectId,
      shift,
      ttlSeconds,
      shiftStart,
      shiftEnd
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
      shiftStart,
      shiftEnd
    };
  }

  async _sendShiftEvent(departmentObjectId, shift, ttlSeconds, shiftStart, shiftEnd) {
    const isInPool = await assigneePoolService.hasAssignee(departmentObjectId, shift.accountId, shift.assigneeEmail);

    const dataForEvent = {
      departmentId: shift.department._id.toString(),
      departmentObjectId: departmentObjectId,
      accountId: shift.accountId,
      assigneeEmail: shift.assigneeEmail,
      assigneeName: shift.assigneeName,
      taskTypeWeights: shift.department.taskTypeWeights || [],
      loadCalculationFormula: shift.department.loadCalculationFormula || 'sum(taskWeights) / maxLoad',
      defaultMaxLoad: shift.department.defaultMaxLoad || 100,
      priorityMultiplier: shift.department.priorityMultiplier || 1,
      completedTasksCount: shift.department.completedTasksCount || 0,
      shiftStartTime: shiftStart.toISOString(),
      shiftEndTime: shiftEnd.toISOString(),
      limits: shift.limits || { maxDailyIssues: 30, maxActiveIssues: 30, preferredLoadPercent: 80 },
      ttl: ttlSeconds,
      updatedAt: moment().tz(this.TIMEZONE).toISOString()
    };

    if (isInPool) {
      sendShiftUpdatedEvent(dataForEvent).catch((err) => {
        console.error(`[ShiftScheduler] ❌ Ошибка отправки события shift_updated для ${shift.assigneeName}:`, err.message);
      });

      console.log(`[ShiftScheduler] ✅ Отправлено событие обновления для ${shift.assigneeName} (TTL: ${Math.floor(ttlSeconds / 60)} мин)`);
      return { updated: true };
    } else {
      sendShiftCreatedEvent(dataForEvent).catch((err) => {
        console.error(`[ShiftScheduler] ❌ Ошибка отправки события shift_created для ${shift.assigneeName}:`, err.message);
      });

      console.log(`[ShiftScheduler] ✅ Отправлено событие создания для ${shift.assigneeName} (TTL: ${Math.floor(ttlSeconds / 60)} мин)`);
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
