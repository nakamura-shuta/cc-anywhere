// 共有型定義: タスク関連
// バックエンドとフロントエンドで共通して使用する型定義

export interface Task {
  id: string;
  instruction: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  result?: any;
  options?: TaskOptions;
  context?: TaskContext;
}

export interface TaskOptions {
  timeout?: number;
  async?: boolean;
  retry?: {
    count: number;
    delay: number;
  };
}

export interface TaskContext {
  workingDirectory?: string;
  files?: string[];
  environment?: Record<string, string>;
}

export interface TaskProgress {
  taskId: string;
  progress: number; // 0-100
  message?: string;
  details?: any;
}

export interface TaskLog {
  taskId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}