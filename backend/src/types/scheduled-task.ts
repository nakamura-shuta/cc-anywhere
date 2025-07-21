import type { TaskRequest } from "../claude/types.js";

export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  taskRequest: TaskRequest;
  schedule: {
    type: "cron" | "once";
    expression?: string; // cron式（type='cron'の場合）
    executeAt?: Date; // 実行時刻（type='once'の場合）
    timezone?: string; // タイムゾーン
  };
  status: "active" | "inactive" | "completed" | "failed";
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastExecutedAt?: Date;
    nextExecuteAt?: Date;
    executionCount: number;
  };
  history: ScheduledTaskHistory[];
}

export interface ScheduledTaskHistory {
  executedAt: Date;
  taskId: string; // 実行されたタスクのID
  status: "success" | "failure";
  error?: string;
}

export interface ScheduleListOptions {
  limit?: number;
  offset?: number;
  status?: ScheduledTask["status"];
}

export interface ScheduleListResponse {
  schedules: ScheduledTask[];
  total: number;
}
