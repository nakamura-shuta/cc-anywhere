/**
 * Event system types and interfaces
 */

/**
 * Base event structure
 */
export interface Event<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type/name */
  type: string;
  /** When the event occurred */
  timestamp: Date;
  /** Event payload */
  payload: T;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (event: Event<T>) => void | Promise<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Unsubscribe from the event */
  unsubscribe(): void;
}

/**
 * Event bus interface
 */
export interface IEventBus {
  /**
   * Emit an event
   * @param event The event to emit
   */
  emit<T>(event: Event<T>): Promise<void>;

  /**
   * Subscribe to an event type
   * @param eventType The event type to listen for
   * @param handler The handler function
   * @returns Subscription object
   */
  on<T>(eventType: string, handler: EventHandler<T>): EventSubscription;

  /**
   * Subscribe to an event type once
   * @param eventType The event type to listen for
   * @param handler The handler function
   * @returns Subscription object
   */
  once<T>(eventType: string, handler: EventHandler<T>): EventSubscription;

  /**
   * Unsubscribe a handler from an event type
   * @param eventType The event type
   * @param handler The handler to remove
   */
  off(eventType: string, handler: EventHandler): void;

  /**
   * Remove all handlers for an event type
   * @param eventType The event type
   */
  removeAllListeners(eventType?: string): void;

  /**
   * Get the number of listeners for an event type
   * @param eventType The event type
   * @returns Number of listeners
   */
  listenerCount(eventType: string): number;
}

/**
 * Event emitter options
 */
export interface EventBusOptions {
  /** Maximum number of listeners per event (0 = unlimited) */
  maxListeners?: number;
  /** Whether to catch and log handler errors */
  captureErrors?: boolean;
  /** Error handler for async errors */
  errorHandler?: (error: Error, event: Event) => void;
}
