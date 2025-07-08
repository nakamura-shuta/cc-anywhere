import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";
import type { Event, EventHandler, EventSubscription, IEventBus, EventBusOptions } from "./types";

/**
 * Central event bus implementation
 *
 * Provides a decoupled way for components to communicate through events
 */
export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private onceHandlers = new Map<string, Set<EventHandler>>();
  private readonly options: Required<EventBusOptions>;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 0,
      captureErrors: options.captureErrors ?? true,
      errorHandler: options.errorHandler ?? this.defaultErrorHandler.bind(this),
    };
  }

  async emit<T>(event: Event<T>): Promise<void> {
    logger.debug("Emitting event", {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
    });

    // Get regular handlers
    const handlers = this.handlers.get(event.type) || new Set();
    // Get once handlers
    const onceHandlers = this.onceHandlers.get(event.type) || new Set();

    // Combine all handlers
    const allHandlers = [...handlers, ...onceHandlers];

    // Clear once handlers
    if (onceHandlers.size > 0) {
      this.onceHandlers.delete(event.type);
    }

    // Execute handlers
    const promises = allHandlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        if (this.options.captureErrors) {
          this.options.errorHandler(error as Error, event);
        } else {
          throw error;
        }
      }
    });

    await Promise.all(promises);
  }

  on<T>(eventType: string, handler: EventHandler<T>): EventSubscription {
    this.addHandler(eventType, handler as EventHandler, false);

    return {
      unsubscribe: () => this.off(eventType, handler as EventHandler),
    };
  }

  once<T>(eventType: string, handler: EventHandler<T>): EventSubscription {
    this.addHandler(eventType, handler as EventHandler, true);

    return {
      unsubscribe: () => this.off(eventType, handler as EventHandler),
    };
  }

  off(eventType: string, handler: EventHandler): void {
    // Remove from regular handlers
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }

    // Remove from once handlers
    const onceHandlers = this.onceHandlers.get(eventType);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceHandlers.delete(eventType);
      }
    }
  }

  removeAllListeners(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
      this.onceHandlers.delete(eventType);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  listenerCount(eventType: string): number {
    const regularCount = this.handlers.get(eventType)?.size || 0;
    const onceCount = this.onceHandlers.get(eventType)?.size || 0;
    return regularCount + onceCount;
  }

  /**
   * Create an event with generated ID and timestamp
   */
  static createEvent<T>(type: string, payload: T, metadata?: Record<string, unknown>): Event<T> {
    return {
      id: uuidv4(),
      type,
      timestamp: new Date(),
      payload,
      metadata,
    };
  }

  private addHandler(eventType: string, handler: EventHandler, once: boolean): void {
    // Check max listeners
    if (this.options.maxListeners > 0) {
      const currentCount = this.listenerCount(eventType);
      if (currentCount >= this.options.maxListeners) {
        logger.warn("Max listeners exceeded for event type", {
          eventType,
          maxListeners: this.options.maxListeners,
          currentCount,
        });
      }
    }

    const targetMap = once ? this.onceHandlers : this.handlers;
    let handlers = targetMap.get(eventType);
    if (!handlers) {
      handlers = new Set();
      targetMap.set(eventType, handlers);
    }
    handlers.add(handler);
  }

  private defaultErrorHandler(error: Error, event: Event): void {
    logger.error("Event handler error", {
      eventId: event.id,
      eventType: event.type,
      error: error.message,
      stack: error.stack,
    });
  }
}

// Singleton instance for global event bus
let globalEventBus: EventBus | null = null;

/**
 * Get the global event bus instance
 */
export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}
