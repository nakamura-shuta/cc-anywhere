// API型定義

// タスクステータス
export enum TaskStatus {
	PENDING = "pending",
	RUNNING = "running",
	COMPLETED = "completed",
	FAILED = "failed",
	CANCELLED = "cancelled",
	TIMEOUT = "timeout"
}

// リトライポリシー
export enum RetryPolicy {
	NONE = "none",
	EXPONENTIAL = "exponential",
	LINEAR = "linear"
}

// リトライオプション
export interface RetryOptions {
	maxRetries?: number;
	initialDelay?: number;
	maxDelay?: number;
	backoffMultiplier?: number;
	retryableErrors?: string[];
	policy?: RetryPolicy;
}

// タスクコンテキスト
export interface TaskContext {
	workingDirectory?: string;
	files?: string[];
	repositories?: string[]; // 複数リポジトリのパス
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
}

// Claude Code SDKオプション
export interface ClaudeCodeSDKOptions {
	maxTurns?: number;
	allowedTools?: string[];
	disallowedTools?: string[];
	systemPrompt?: string;
	permissionMode?: "default" | "ask" | "allow" | "deny" | "acceptEdits" | "bypassPermissions" | "plan";
	executable?: "node" | "bun" | "deno";
	executableArgs?: string[];
	continueSession?: boolean;
	resumeSession?: string;
	outputFormat?: "text" | "json" | "stream-json";
	verbose?: boolean;
}

// タスクリクエスト
export interface TaskRequest {
	instruction: string;
	context?: TaskContext;
	options?: {
		timeout?: number;
		async?: boolean;
		retry?: RetryOptions;
		sdk?: ClaudeCodeSDKOptions;
	};
}

// タスクレスポンス
export interface TaskResponse {
	id: string; // taskIdとidの両方をサポート
	taskId: string;
	status: TaskStatus;
	instruction: string;
	createdAt: string;
	updatedAt: string;
	startedAt?: string;
	completedAt?: string;
	workingDirectory?: string;
	context?: TaskContext;
	result?: any;
	error?: {
		message: string;
		code: string;
	};
	logs?: string[];
	// 継続タスク関連
	continuedFrom?: string;
	parentTaskId?: string;
	duration?: number;
	options?: {
		permissionMode?: string;
		timeout?: number;
		[key: string]: any;
	};
}

// タスクログレスポンス
export interface TaskLogResponse {
	logs: string[];
	status: TaskStatus;
	completed: boolean;
}

// バッチタスクリクエスト
export interface BatchTaskRequest {
	tasks: TaskRequest[];
	parallel?: boolean;
	continueOnError?: boolean;
	groupName?: string;
}

// バッチタスクレスポンス
export interface BatchTaskResponse {
	groupId: string;
	tasks: TaskResponse[];
	createdAt: string;
}

// バッチタスクステータス
export interface BatchTaskStatus {
	groupId: string;
	total: number;
	completed: number;
	failed: number;
	pending: number;
	running: number;
	tasks: TaskResponse[];
}

// プリセット
export interface Preset {
	id: string;
	name: string;
	description?: string;
	instruction: string;
	context?: TaskContext;
	options?: TaskRequest['options'];
	createdAt: string;
	updatedAt: string;
}

// スケジュールタスク
export interface ScheduledTask {
	id: string;
	name: string;
	description?: string;
	schedule: string; // cron expression
	taskRequest: TaskRequest;
	enabled: boolean;
	lastRun?: string;
	nextRun?: string;
	createdAt: string;
	updatedAt: string;
}

// セッション
export interface Session {
	id: string;
	name?: string;
	description?: string;
	status: 'active' | 'completed' | 'failed';
	context?: TaskContext;
	createdAt: string;
	updatedAt: string;
	lastActivity?: string;
}

// ワーカー情報
export interface WorkerInfo {
	id: string;
	name: string;
	status: 'idle' | 'busy' | 'offline';
	currentTask?: string;
	tasksCompleted: number;
	tasksFailed: number;
	uptime: number;
	lastActivity?: string;
}

// ヘルスチェックレスポンス
export interface HealthCheckResponse {
	status: 'ok' | 'error';
	version: string;
	uptime: number;
	timestamp: string;
	services: {
		database: 'ok' | 'error';
		queue: 'ok' | 'error';
		workers: 'ok' | 'error';
	};
}

// ページネーション
export interface PaginationParams {
	page?: number;
	limit?: number;
	sort?: string;
	order?: 'asc' | 'desc';
	[key: string]: string | number | boolean | undefined;
}

// ページネーションレスポンス
export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}