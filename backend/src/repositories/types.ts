/**
 * Repository pattern interfaces
 */

/**
 * Base repository interface for CRUD operations
 */
export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(entity: T): Promise<T>;
  update(id: ID, entity: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Query filter
 */
export interface QueryFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "like";
  value: unknown;
}

/**
 * Repository with advanced querying
 */
export interface IQueryableRepository<T, ID = string> extends IRepository<T, ID> {
  findOne(filters: QueryFilter[]): Promise<T | null>;
  findMany(filters: QueryFilter[], options?: PaginationOptions): Promise<PaginatedResult<T>>;
  count(filters?: QueryFilter[]): Promise<number>;
  exists(id: ID): Promise<boolean>;
}

/**
 * Unit of Work pattern for transaction management
 */
export interface IUnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

/**
 * Repository factory
 */
export interface IRepositoryFactory {
  createTaskRepository(): ITaskRepository;
  createBatchTaskRepository(): IBatchTaskRepository;
  createWorktreeRepository(): IWorktreeRepository;
}

/**
 * Task-specific repository interface
 */
export interface ITaskRepository extends IQueryableRepository<TaskEntity, string> {
  findByStatus(status: string): Promise<TaskEntity[]>;
  findPendingTasks(): Promise<TaskEntity[]>;
  updateStatus(id: string, status: string, error?: Error): Promise<void>;
  updateResult(id: string, result: unknown): Promise<void>;
  updateProgressData(id: string, progressData: unknown): Promise<void>;
  updateRetryMetadata(id: string, metadata: unknown, nextRetryAt?: Date): Promise<void>;
  resetTaskForRetry(id: string): Promise<void>;
  updateConversationHistory(id: string, conversationHistory: unknown): Promise<void>;
}

/**
 * Batch task repository interface
 */
export interface IBatchTaskRepository extends IQueryableRepository<BatchTaskEntity, string> {
  findByGroupId(groupId: string): Promise<BatchTaskEntity[]>;
  countByGroupIdAndStatus(groupId: string, status: string): Promise<number>;
}

/**
 * Worktree repository interface
 */
export interface IWorktreeRepository extends IQueryableRepository<WorktreeEntity, string> {
  findByTaskId(taskId: string): Promise<WorktreeEntity | null>;
  findByPath(path: string): Promise<WorktreeEntity | null>;
  findStaleWorktrees(olderThan: Date): Promise<WorktreeEntity[]>;
  markAsActive(id: string): Promise<void>;
  markAsInactive(id: string): Promise<void>;
}

/**
 * Entity interfaces
 */

export interface TaskEntity {
  id: string;
  instruction: string;
  context?: unknown;
  options?: unknown;
  priority: number;
  status: string;
  result?: unknown;
  error?: unknown;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  retryMetadata?: unknown;
  nextRetryAt?: Date;
  groupId?: string;
  repositoryName?: string;
  conversationHistory?: unknown;
  continuedFrom?: string;
  progressData?: unknown;
}

export interface BatchTaskEntity {
  id: string;
  groupId: string;
  taskId: string;
  repositoryName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorktreeEntity {
  id: string;
  taskId: string;
  path: string;
  baseBranch: string;
  worktreeBranch: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
}

/**
 * Compare task status
 */
export type CompareTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial_success"
  | "failed"
  | "cancelling"
  | "cancelled";

/**
 * Compare task entity for LLM comparison mode
 */
export interface CompareTaskEntity {
  id: string;
  instruction: string;
  repositoryId: string;
  repositoryPath: string;
  baseCommit: string;
  claudeTaskId: string | null;
  codexTaskId: string | null;
  geminiTaskId: string | null;
  status: CompareTaskStatus;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Compare task repository interface
 */
export interface ICompareTaskRepository extends IQueryableRepository<CompareTaskEntity, string> {
  findByStatus(status: CompareTaskStatus): Promise<CompareTaskEntity[]>;
  findRunningTasks(): Promise<CompareTaskEntity[]>;
  countRunningTasks(): Promise<number>;
  updateStatus(id: string, status: CompareTaskStatus): Promise<void>;
  markCompleted(id: string, status: CompareTaskStatus): Promise<void>;
}
