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

// Executor type
export type ExecutorType = "claude" | "codex" | "gemini";

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
	continueFromTaskId?: string; // SDK Continue機能用
	outputFormat?: "text" | "json" | "stream-json";
	verbose?: boolean;
}

// Codex SDKオプション
export interface CodexExecutorOptions {
	sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
	skipGitRepoCheck?: boolean;
	model?: string;
	networkAccess?: boolean; // ネットワークアクセス (v0.57.0+)
	webSearch?: boolean; // Web検索 (v0.57.0+)
	continueSession?: boolean;
	resumeSession?: string; // Codex thread ID
}

// Gemini SDKオプション
export interface GeminiExecutorOptions {
	model?: string; // default: gemini-3-pro-preview
	thinkingBudget?: number; // 思考トークン制御
	enableGoogleSearch?: boolean; // Google Search有効化
	enableCodeExecution?: boolean; // Code Execution有効化
	streaming?: boolean; // default: true
	systemPrompt?: string; // システムプロンプト
}

// Worktreeオプション
export interface WorktreeOptions {
	enabled: boolean;
	baseBranch?: string;
	branchName?: string;
	keepAfterCompletion?: boolean;
	autoCommit?: boolean;
	commitMessage?: string;
	autoMerge?: boolean;
	mergeStrategy?: "merge" | "rebase" | "squash";
	targetBranch?: string;
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
		codex?: CodexExecutorOptions;
		gemini?: GeminiExecutorOptions;
		useWorktree?: boolean;
		worktree?: WorktreeOptions;
		executor?: ExecutorType;
	};
}

// タスクレスポンス
export interface TaskResponse {
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
	sdkSessionId?: string; // Claude Code SDK session ID
	executor?: ExecutorType; // Executor type used for this task
	executorMetadata?: Record<string, any>; // Executor-specific metadata
	options?: {
		permissionMode?: string;
		timeout?: number;
		executor?: ExecutorType;
		[key: string]: any;
	};
	// 進捗データ（統計情報を含む）
	progressData?: {
		currentTurn?: number;
		maxTurns?: number;
		toolUsageCount?: Record<string, number>;
		statistics?: {
			totalToolCalls: number;
			processedFiles: number;
			createdFiles: number;
			modifiedFiles: number;
			totalExecutions: number;
			// ✅ Codex SDK v0.52.0: トークン使用量（Codex executor限定）
			tokenUsage?: {
				input: number;
				output: number;
				cached?: number; // Codex executorのみ返す（Claude executorは未定義）
			};
		};
		todos?: any[];
	};
}

// タスクログレスポンス
export interface TaskLogResponse {
	logs: string[];
	status: TaskStatus;
	completed: boolean;
}

// リポジトリ設定
export interface RepositoryConfig {
	name: string;
	path: string;
	timeout?: number;
	retryOptions?: RetryOptions;
}

// バッチタスクリクエスト
export interface BatchTaskRequest {
	instruction: string;
	repositories: RepositoryConfig[];
	options?: {
		timeout?: number;
		async?: boolean;
		sdk?: ClaudeCodeSDKOptions;
		parallel?: boolean;
		continueOnError?: boolean;
		groupName?: string;
	};
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
export interface TaskPreset {
	id: string;
	name: string;
	description?: string;
	isSystem: boolean;
	settings: {
		sdk?: Record<string, any>;
		timeout?: number;
		useWorktree?: boolean;
		worktree?: Record<string, any>;
		allowedTools?: string[]; // Legacy support
	};
	createdAt?: string;
	updatedAt?: string;
}

// プリセット設定レスポンス
export interface PresetsConfig {
	presets: TaskPreset[];
	userPresets: TaskPreset[];
}

// スケジュール設定
export interface ScheduleConfig {
	type: "cron" | "once";
	expression?: string; // cron式（type='cron'の場合）
	executeAt?: string; // 実行時刻（type='once'の場合）ISO 8601形式
	timezone?: string; // タイムゾーン
}

// スケジュールメタデータ
export interface ScheduleMetadata {
	createdAt: string;
	updatedAt: string;
	lastExecutedAt?: string;
	nextExecuteAt?: string;
	executionCount: number;
}

// スケジュール履歴
export interface ScheduledTaskHistory {
	executedAt: string;
	taskId: string; // 実行されたタスクのID
	status: "success" | "failure";
	error?: string;
}

// スケジュールタスク
export interface ScheduledTask {
	id: string;
	name: string;
	description?: string;
	taskRequest: TaskRequest;
	schedule: ScheduleConfig;
	status: "active" | "inactive" | "completed" | "failed";
	metadata: ScheduleMetadata;
	history?: ScheduledTaskHistory[];
}

// セッションコンテキスト
export interface SessionContext {
	workingDirectory?: string;
	environment?: Record<string, string>;
	systemPrompt?: string;
	defaultOptions?: {
		permissionMode?: string;
		maxTurns?: number;
		allowedTools?: string[];
	};
}

// セッションメタデータ
export interface SessionMetadata {
	title?: string;
	description?: string;
	tags?: string[];
	totalTurns?: number;
	lastActivityAt?: string;
}

// セッション
export interface Session {
	id: string;
	userId?: string;
	status: 'active' | 'paused' | 'completed' | 'expired';
	context?: SessionContext;
	metadata?: SessionMetadata;
	createdAt: string;
	updatedAt: string;
	expiresAt?: string;
}

// 会話ターンメタデータ
export interface TurnMetadata {
	taskId?: string;
	duration?: number;
	toolsUsed?: string[];
	filesModified?: string[];
	error?: any;
}

// 会話ターン
export interface ConversationTurn {
	id?: number;
	sessionId: string;
	turnNumber: number;
	instruction: string;
	response?: string;
	metadata?: TurnMetadata;
	createdAt: string;
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

// スケジュール一覧レスポンス
export interface ScheduleListResponse {
	schedules: ScheduledTask[];
	total: number;
}

// セッション作成リクエスト
export interface CreateSessionRequest {
	userId?: string;
	context?: SessionContext;
	metadata?: SessionMetadata;
	expiresIn?: number; // 有効期限（秒）
}

// セッション作成レスポンス
export interface CreateSessionResponse {
	session: Session;
}

// セッション継続リクエスト
export interface ContinueSessionRequest {
	sessionId: string;
	instruction: string;
	options?: {
		timeout?: number;
		permissionMode?: string;
		allowedTools?: string[];
		[key: string]: any;
	};
}

// セッション継続レスポンス
export interface ContinueSessionResponse {
	turnNumber: number;
	taskId: string;
	result?: any;
	error?: any;
}

// セッション履歴レスポンス
export interface GetSessionHistoryResponse {
	sessionId: string;
	turns: ConversationTurn[];
	totalTurns: number;
	hasMore: boolean;
}

// セッション一覧レスポンス
export interface ListSessionsResponse {
	sessions: Session[];
	total: number;
	hasMore: boolean;
}

// Executor機能フラグ
export interface ExecutorCapabilities {
	// セッション管理
	sessionContinuation: boolean;
	sessionResume: boolean;
	crossRepositorySession: boolean;

	// ターン制御
	maxTurnsLimit: boolean;

	// ツール制御
	toolFiltering: boolean;

	// 権限制御
	permissionModes: boolean;

	// プロンプト制御
	customSystemPrompt: boolean;

	// 出力制御
	outputFormatting: boolean;
	verboseMode: boolean;

	// サンドボックス
	sandboxControl: boolean;

	// その他
	modelSelection: boolean;
	webSearch: boolean;
}

// Executor情報
export interface ExecutorInfo {
	type: ExecutorType;
	available: boolean;
	description: string;
	capabilities?: ExecutorCapabilities;
}

// Executors一覧レスポンス
export interface ListExecutorsResponse {
	executors: ExecutorInfo[];
}