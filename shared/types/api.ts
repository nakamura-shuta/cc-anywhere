// 共有型定義: API関連
// APIリクエスト/レスポンスの型定義

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
  };
}

export interface CreateTaskRequest {
  instruction: string;
  options?: {
    timeout?: number;
    async?: boolean;
  };
  context?: {
    workingDirectory?: string;
    files?: string[];
  };
}

export interface CreateTaskResponse {
  taskId: string;
  status: string;
  createdAt: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}