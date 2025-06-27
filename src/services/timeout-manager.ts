import {
  TimeoutPhase,
  TimeoutBehavior,
  TimeoutError,
  DEFAULT_TIMEOUT_CONFIG,
  type TimeoutConfig,
  type TimeoutState,
  type TimeoutWarning,
} from "../types/timeout";
import { logger } from "../utils/logger";

export class TimeoutManager {
  private state: TimeoutState;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly onWarning?: (warning: TimeoutWarning) => void;
  private readonly onTimeout?: (error: TimeoutError) => void;
  private disposed = false;

  constructor(
    config: TimeoutConfig = {},
    onWarning?: (warning: TimeoutWarning) => void,
    onTimeout?: (error: TimeoutError) => void,
  ) {
    this.onWarning = onWarning;
    this.onTimeout = onTimeout;

    // Merge with defaults
    const fullConfig = { ...DEFAULT_TIMEOUT_CONFIG, ...config };

    // Initialize state
    this.state = {
      phase: TimeoutPhase.SETUP,
      phaseStartTime: Date.now(),
      totalStartTime: Date.now(),
      phaseWarningEmitted: false,
      totalWarningEmitted: false,
      phaseTimeouts: {
        [TimeoutPhase.SETUP]: fullConfig.setup,
        [TimeoutPhase.EXECUTION]: fullConfig.execution,
        [TimeoutPhase.CLEANUP]: fullConfig.cleanup,
      },
      totalTimeout: fullConfig.total,
      behavior: fullConfig.behavior,
    };

    // Start monitoring
    this.startMonitoring(fullConfig.warningThreshold);
  }

  getState(): Readonly<TimeoutState> {
    return { ...this.state };
  }

  transitionToPhase(phase: TimeoutPhase): void {
    if (this.disposed) return;

    logger.debug("Transitioning timeout phase", {
      from: this.state.phase,
      to: phase,
      phaseElapsed: this.getPhaseElapsed(),
    });

    this.state.phase = phase;
    this.state.phaseStartTime = Date.now();
    this.state.phaseWarningEmitted = false;

    // Restart monitoring for new phase
    this.restartMonitoring();
  }

  getPhaseElapsed(): number {
    return Date.now() - this.state.phaseStartTime;
  }

  getTotalElapsed(): number {
    return Date.now() - this.state.totalStartTime;
  }

  getPhaseRemaining(): number {
    const limit = this.state.phaseTimeouts[this.state.phase];
    const remaining = limit - this.getPhaseElapsed();
    return Math.max(0, remaining);
  }

  getTotalRemaining(): number {
    const remaining = this.state.totalTimeout - this.getTotalElapsed();
    return Math.max(0, remaining);
  }

  getGracePeriod(): number {
    if (this.state.behavior === TimeoutBehavior.HARD) {
      return 0;
    }
    return this.state.phaseTimeouts[TimeoutPhase.CLEANUP];
  }

  extendPhaseTimeout(additionalMs: number): void {
    if (this.disposed) return;

    const currentPhase = this.state.phase;
    this.state.phaseTimeouts[currentPhase] += additionalMs;
    this.state.phaseWarningEmitted = false;

    logger.info("Extended phase timeout", {
      phase: currentPhase,
      additionalMs,
      newTimeout: this.state.phaseTimeouts[currentPhase],
    });

    this.restartMonitoring();
  }

  extendTotalTimeout(additionalMs: number): void {
    if (this.disposed) return;

    this.state.totalTimeout += additionalMs;
    this.state.totalWarningEmitted = false;

    logger.info("Extended total timeout", {
      additionalMs,
      newTimeout: this.state.totalTimeout,
    });

    this.restartMonitoring();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  private startMonitoring(warningThreshold: number): void {
    if (this.disposed) return;

    // Monitor phase timeout
    this.schedulePhaseCheck(warningThreshold);

    // Monitor total timeout
    this.scheduleTotalCheck(warningThreshold);
  }

  private restartMonitoring(): void {
    this.clearTimers();
    const config = this.getConfigFromState();
    this.startMonitoring(config.warningThreshold);
  }

  private schedulePhaseCheck(warningThreshold: number): void {
    const phaseLimit = this.state.phaseTimeouts[this.state.phase];
    const elapsed = this.getPhaseElapsed();
    const warningTime = phaseLimit * warningThreshold - elapsed;
    const timeoutTime = phaseLimit - elapsed;

    // Schedule warning
    if (warningTime > 0 && !this.state.phaseWarningEmitted) {
      const warningTimer = setTimeout(() => {
        if (!this.disposed && !this.state.phaseWarningEmitted) {
          this.emitWarning();
        }
      }, warningTime);
      this.timers.set("phase-warning", warningTimer);
    }

    // Schedule timeout
    if (timeoutTime > 0) {
      const timeoutTimer = setTimeout(() => {
        if (!this.disposed) {
          this.emitTimeout();
        }
      }, timeoutTime);
      this.timers.set("phase-timeout", timeoutTimer);
    }
  }

  private scheduleTotalCheck(warningThreshold: number): void {
    const totalLimit = this.state.totalTimeout;
    const elapsed = this.getTotalElapsed();
    const warningTime = totalLimit * warningThreshold - elapsed;
    const timeoutTime = totalLimit - elapsed;

    // Schedule total warning
    if (warningTime > 0 && !this.state.totalWarningEmitted) {
      const warningTimer = setTimeout(() => {
        if (!this.disposed && !this.state.totalWarningEmitted) {
          this.emitTotalWarning();
        }
      }, warningTime);
      this.timers.set("total-warning", warningTimer);
    }

    // Schedule total timeout
    if (timeoutTime > 0) {
      const timeoutTimer = setTimeout(() => {
        if (!this.disposed) {
          this.emitTotalTimeout();
        }
      }, timeoutTime);
      this.timers.set("total-timeout", timeoutTimer);
    }
  }

  private emitWarning(): void {
    const elapsed = this.getPhaseElapsed();
    const limit = this.state.phaseTimeouts[this.state.phase];
    const remaining = limit - elapsed;
    const percentage = elapsed / limit;

    const warning: TimeoutWarning = {
      phase: this.state.phase,
      elapsed,
      limit,
      remaining,
      percentage,
    };

    this.state.phaseWarningEmitted = true;

    logger.warn("Timeout warning", warning);
    this.onWarning?.(warning);
  }

  private emitTotalWarning(): void {
    const elapsed = this.getTotalElapsed();
    const limit = this.state.totalTimeout;
    const remaining = limit - elapsed;
    const percentage = elapsed / limit;

    const warning: TimeoutWarning = {
      phase: this.state.phase,
      elapsed,
      limit,
      remaining,
      percentage,
    };

    this.state.totalWarningEmitted = true;

    logger.warn("Total timeout warning", warning);
    this.onWarning?.(warning);
  }

  private emitTimeout(): void {
    const elapsed = this.getPhaseElapsed();
    const limit = this.state.phaseTimeouts[this.state.phase];

    const error = TimeoutError.fromPhase(this.state.phase, elapsed, limit, this.state.behavior);

    logger.error("Phase timeout exceeded", {
      phase: this.state.phase,
      elapsed,
      limit,
      behavior: this.state.behavior,
    });

    this.onTimeout?.(error);
  }

  private emitTotalTimeout(): void {
    const elapsed = this.getTotalElapsed();
    const limit = this.state.totalTimeout;

    const error = new TimeoutError(
      `Total task timeout exceeded after ${elapsed}ms (limit: ${limit}ms)`,
      this.state.phase,
      elapsed,
      limit,
      this.state.behavior,
    );

    logger.error("Total timeout exceeded", {
      phase: this.state.phase,
      elapsed,
      limit,
      behavior: this.state.behavior,
    });

    this.onTimeout?.(error);
  }

  private clearTimers(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  private getConfigFromState(): Required<TimeoutConfig> {
    return {
      total: this.state.totalTimeout,
      setup: this.state.phaseTimeouts[TimeoutPhase.SETUP],
      execution: this.state.phaseTimeouts[TimeoutPhase.EXECUTION],
      cleanup: this.state.phaseTimeouts[TimeoutPhase.CLEANUP],
      warningThreshold: DEFAULT_TIMEOUT_CONFIG.warningThreshold,
      behavior: this.state.behavior,
    };
  }
}
