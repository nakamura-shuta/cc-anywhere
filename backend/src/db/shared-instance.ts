/**
 * Shared service instances for the application
 * Simple service locator pattern for managing singletons
 */

import { DatabaseProvider } from "./database-provider";
import { TaskRepositoryAdapter } from "../repositories/task-repository-adapter";
import { BatchTaskRepositoryImpl } from "../repositories/batch-task-repository";
import { WorktreeRepositoryImpl } from "../repositories/worktree-repository";
import { ScheduleRepository } from "../repositories/schedule-repository";
import { ChatRepository } from "../repositories/chat-repository";
import { BatchTaskService } from "../services/batch-task-service";
import { config } from "../config";
import type { TaskQueueImpl } from "../queue/task-queue";
import type { Database } from "better-sqlite3";

// Singleton instances
let dbProvider: DatabaseProvider | null = null;
let taskRepository: TaskRepositoryAdapter | null = null;
let batchTaskRepository: BatchTaskRepositoryImpl | null = null;
let worktreeRepository: WorktreeRepositoryImpl | null = null;
let scheduleRepository: ScheduleRepository | null = null;
let chatRepository: ChatRepository | null = null;
let batchTaskService: BatchTaskService | null = null;

/**
 * Get or create database provider instance
 */
export function getSharedDbProvider(): DatabaseProvider {
  if (!dbProvider) {
    dbProvider = new DatabaseProvider(config.database.path);
  }
  return dbProvider;
}

/**
 * Get or create task repository instance
 */
export function getSharedRepository(): TaskRepositoryAdapter {
  if (!taskRepository) {
    taskRepository = new TaskRepositoryAdapter(getSharedDbProvider().getDb());
  }
  return taskRepository;
}

/**
 * Get or create batch task repository instance
 */
export function getSharedBatchTaskRepository(): BatchTaskRepositoryImpl {
  if (!batchTaskRepository) {
    batchTaskRepository = new BatchTaskRepositoryImpl(getSharedDbProvider().getDb());
  }
  return batchTaskRepository;
}

/**
 * Get or create worktree repository instance
 */
export function getSharedWorktreeRepository(): WorktreeRepositoryImpl {
  if (!worktreeRepository) {
    worktreeRepository = new WorktreeRepositoryImpl(getSharedDbProvider().getDb());
  }
  return worktreeRepository;
}

/**
 * Get or create schedule repository instance
 */
export function getSharedScheduleRepository(): ScheduleRepository {
  if (!scheduleRepository) {
    scheduleRepository = new ScheduleRepository(getSharedDbProvider().getDb());
  }
  return scheduleRepository;
}

/**
 * Get or create chat repository instance
 */
export function getSharedChatRepository(): ChatRepository {
  if (!chatRepository) {
    chatRepository = new ChatRepository(getSharedDbProvider().getDb());
  }
  return chatRepository;
}

/**
 * Get or create batch task service instance
 */
export function getSharedBatchTaskService(queue: TaskQueueImpl): BatchTaskService {
  if (!batchTaskService) {
    batchTaskService = new BatchTaskService(getSharedRepository(), queue);
  }
  return batchTaskService;
}

/**
 * Get database instance
 */
export function getDatabaseInstance(): Database {
  return getSharedDbProvider().getDb();
}

/**
 * Close all database connections and reset instances
 */
export function closeSharedServices(): void {
  if (dbProvider) {
    dbProvider.close();
    dbProvider = null;
    taskRepository = null;
    batchTaskRepository = null;
    worktreeRepository = null;
    scheduleRepository = null;
    chatRepository = null;
    batchTaskService = null;
  }
}
