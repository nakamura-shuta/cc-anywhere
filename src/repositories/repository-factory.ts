import type { Database } from "better-sqlite3";
import type {
  IRepositoryFactory,
  ITaskRepository,
  IBatchTaskRepository,
  IWorktreeRepository,
} from "./types.js";
import { TaskRepositoryImpl } from "./task-repository.js";
import { BatchTaskRepositoryImpl } from "./batch-task-repository.js";
import { WorktreeRepositoryImpl } from "./worktree-repository.js";

/**
 * Repository factory implementation
 */
export class RepositoryFactory implements IRepositoryFactory {
  private taskRepository?: ITaskRepository;
  private batchTaskRepository?: IBatchTaskRepository;
  private worktreeRepository?: IWorktreeRepository;

  constructor(private db: Database) {}

  createTaskRepository(): ITaskRepository {
    if (!this.taskRepository) {
      this.taskRepository = new TaskRepositoryImpl(this.db);
    }
    return this.taskRepository;
  }

  createBatchTaskRepository(): IBatchTaskRepository {
    if (!this.batchTaskRepository) {
      this.batchTaskRepository = new BatchTaskRepositoryImpl(this.db);
    }
    return this.batchTaskRepository;
  }

  createWorktreeRepository(): IWorktreeRepository {
    if (!this.worktreeRepository) {
      this.worktreeRepository = new WorktreeRepositoryImpl(this.db);
    }
    return this.worktreeRepository;
  }
}
