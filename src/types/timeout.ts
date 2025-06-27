// Timeout phase enum
export enum TimeoutPhase {
  SETUP = "setup",
  EXECUTION = "execution",
  CLEANUP = "cleanup",
}

// Timeout behavior enum
export enum TimeoutBehavior {
  HARD = "hard", // Immediate termination
  SOFT = "soft", // Graceful shutdown with cleanup
}

// Timeout configuration
export interface TimeoutConfig {
  total?: number; // Total timeout in ms (default: 300000)
  setup?: number; // Setup phase timeout in ms (default: 30000)
  execution?: number; // Execution phase timeout in ms (default: 240000)
  cleanup?: number; // Cleanup phase timeout in ms (default: 30000)
  warningThreshold?: number; // Warning threshold as percentage (0-1, default: 0.9)
  behavior?: TimeoutBehavior; // Timeout behavior (default: soft)
}

// Timeout state tracking
export interface TimeoutState {
  phase: TimeoutPhase;
  phaseStartTime: number;
  totalStartTime: number;
  phaseWarningEmitted: boolean;
  totalWarningEmitted: boolean;
  phaseTimeouts: {
    [TimeoutPhase.SETUP]: number;
    [TimeoutPhase.EXECUTION]: number;
    [TimeoutPhase.CLEANUP]: number;
  };
  totalTimeout: number;
  behavior: TimeoutBehavior;
}

// Timeout error with context
export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly phase: TimeoutPhase,
    public readonly elapsed: number,
    public readonly limit: number,
    public readonly behavior: TimeoutBehavior,
  ) {
    super(message);
    this.name = "TimeoutError";
  }

  static fromPhase(
    phase: TimeoutPhase,
    elapsed: number,
    limit: number,
    behavior: TimeoutBehavior,
  ): TimeoutError {
    const message = `Task timed out during ${phase} phase after ${elapsed}ms (limit: ${limit}ms, behavior: ${behavior})`;
    return new TimeoutError(message, phase, elapsed, limit, behavior);
  }
}

// Timeout warning event
export interface TimeoutWarning {
  phase: TimeoutPhase;
  elapsed: number;
  limit: number;
  remaining: number;
  percentage: number;
}

// Default timeout configuration
export const DEFAULT_TIMEOUT_CONFIG: Required<TimeoutConfig> = {
  total: 300000, // 5 minutes
  setup: 30000, // 30 seconds
  execution: 240000, // 4 minutes
  cleanup: 30000, // 30 seconds
  warningThreshold: 0.9, // 90%
  behavior: TimeoutBehavior.SOFT,
};
