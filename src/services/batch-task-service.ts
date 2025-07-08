import { v4 as uuidv4 } from "uuid";
import type { TaskRepository } from "../db/task-repository";
import type { TaskQueue } from "../queue/task-queue";
import type {
  CreateBatchTaskParams,
  BatchTaskResponse,
  BatchTaskStatus,
} from "../types/batch-task";
import { TaskStatus, type TaskRequest } from "../claude/types";
import { logger } from "../utils/logger";
import { ValidationError } from "../utils/errors";

export class BatchTaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly taskQueue: TaskQueue,
  ) {}

  async createBatchTasks(params: CreateBatchTaskParams): Promise<BatchTaskResponse> {
    // バリデーション
    if (!params.instruction) {
      throw new ValidationError("instruction is required");
    }

    if (!params.repositories || params.repositories.length === 0) {
      throw new ValidationError("At least one repository is required");
    }

    // グループIDを生成
    const groupId = `group_${uuidv4()}`;
    const tasks: Array<{ taskId: string; repository: string; status: TaskStatus }> = [];

    logger.info("Creating batch tasks", {
      groupId,
      instruction: params.instruction,
      repositoryCount: params.repositories.length,
    });

    // 各リポジトリに対してタスクを作成
    for (const repo of params.repositories) {
      const taskRequest: TaskRequest = {
        instruction: params.instruction,
        context: {
          workingDirectory: repo.path,
        },
        options: {
          timeout: repo.timeout || params.options?.timeout,
          allowedTools: params.options?.allowedTools,
          retry: repo.retryOptions || params.options?.retry,
        },
      };

      // キューに追加（これがタスクを作成する）
      const taskId = this.taskQueue.add(taskRequest, 0, {
        groupId,
        repositoryName: repo.name,
      });

      tasks.push({
        taskId,
        repository: repo.name,
        status: TaskStatus.PENDING,
      });
    }

    logger.info("Batch tasks created successfully", {
      groupId,
      taskCount: tasks.length,
    });

    return {
      groupId,
      tasks,
    };
  }

  async getBatchTaskStatus(groupId: string): Promise<BatchTaskStatus | null> {
    // グループIDに属するすべてのタスクを取得
    const tasks = await this.taskRepository.findByGroupId(groupId);

    if (!tasks || tasks.length === 0) {
      return null;
    }

    // ステータスの集計
    const summary = {
      total: tasks.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    const taskDetails = tasks.map((task: any) => {
      // ステータスの集計
      switch (task.status) {
        case TaskStatus.PENDING:
          summary.pending++;
          break;
        case TaskStatus.RUNNING:
          summary.running++;
          break;
        case TaskStatus.COMPLETED:
          summary.completed++;
          break;
        case TaskStatus.FAILED:
          summary.failed++;
          break;
      }

      return {
        taskId: task.id,
        repository: task.repository_name || "unknown",
        status: task.status,
        duration: task.duration,
        result: task.result,
        error: task.error,
      };
    });

    return {
      groupId,
      summary,
      tasks: taskDetails,
    };
  }
}
