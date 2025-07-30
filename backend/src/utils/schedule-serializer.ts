import type { ScheduledTask } from "../types/scheduled-task.js";

/**
 * スケジュールオブジェクトをAPIレスポンス用にシリアライズ
 * Date型をISO文字列に変換
 */
export function serializeSchedule(schedule: ScheduledTask): any {
  return {
    ...schedule,
    schedule: {
      ...schedule.schedule,
      executeAt: schedule.schedule.executeAt
        ? schedule.schedule.executeAt instanceof Date
          ? schedule.schedule.executeAt.toISOString()
          : schedule.schedule.executeAt
        : undefined,
    },
    metadata: {
      ...schedule.metadata,
      createdAt:
        schedule.metadata.createdAt instanceof Date
          ? schedule.metadata.createdAt.toISOString()
          : schedule.metadata.createdAt,
      updatedAt:
        schedule.metadata.updatedAt instanceof Date
          ? schedule.metadata.updatedAt.toISOString()
          : schedule.metadata.updatedAt,
      lastExecutedAt: schedule.metadata.lastExecutedAt
        ? schedule.metadata.lastExecutedAt instanceof Date
          ? schedule.metadata.lastExecutedAt.toISOString()
          : schedule.metadata.lastExecutedAt
        : undefined,
      nextExecuteAt: schedule.metadata.nextExecuteAt
        ? schedule.metadata.nextExecuteAt instanceof Date
          ? schedule.metadata.nextExecuteAt.toISOString()
          : schedule.metadata.nextExecuteAt
        : undefined,
    },
    history: schedule.history.map((h) => ({
      ...h,
      executedAt: h.executedAt instanceof Date ? h.executedAt.toISOString() : h.executedAt,
    })),
  };
}

/**
 * スケジュール配列をシリアライズ
 */
export function serializeSchedules(schedules: ScheduledTask[]): any[] {
  return schedules.map(serializeSchedule);
}
