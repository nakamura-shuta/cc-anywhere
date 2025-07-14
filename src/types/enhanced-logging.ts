// Enhanced logging types for better task execution visibility

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  TOOL = "tool",
  WARNING = "warning",
  ERROR = "error",
  SUCCESS = "success",
}

export interface ToolUsageDetail {
  tool: string;
  status: "start" | "success" | "failure";
  filePath?: string;
  command?: string;
  pattern?: string;
  url?: string;
  error?: string;
  timestamp: Date;
}

export interface TaskProgressInfo {
  phase: "setup" | "planning" | "execution" | "cleanup" | "complete";
  message: string;
  level: LogLevel;
  timestamp: Date;
}

export interface TaskSummary {
  totalDuration: number;
  toolsUsed: {
    tool: string;
    count: number;
    successCount: number;
    failureCount: number;
    details: string[];
  }[];
  filesModified: string[];
  filesRead: string[];
  filesCreated: string[];
  commandsExecuted: {
    command: string;
    success: boolean;
  }[];
  errors: {
    message: string;
    tool?: string;
    timestamp: Date;
  }[];
  outcome: "success" | "partial_success" | "failure";
  highlights: string[]; // 重要な成果のリスト
}

// WebSocket message types
export interface ToolUsageMessage {
  type: "task:tool_usage";
  payload: {
    taskId: string;
    tool: ToolUsageDetail;
  };
}

export interface TaskProgressMessage {
  type: "task:progress";
  payload: {
    taskId: string;
    progress: TaskProgressInfo;
  };
}

export interface TaskSummaryMessage {
  type: "task:summary";
  payload: {
    taskId: string;
    summary: TaskSummary;
  };
}
