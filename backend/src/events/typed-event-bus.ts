import type { Event, EventHandler, EventSubscription } from "./types";
import { EventBus } from "./event-bus";
import type { DomainEventMap, DomainEventType } from "./domain-events";

/**
 * Type-safe wrapper around EventBus for domain events
 */
export class TypedEventBus {
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Emit a domain event
   */
  async emit<T extends DomainEventType>(
    type: T,
    payload: DomainEventMap[T],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const event = EventBus.createEvent(type, payload, metadata);
    await this.eventBus.emit(event);
  }

  /**
   * Subscribe to a domain event
   */
  on<T extends DomainEventType>(
    type: T,
    handler: (payload: DomainEventMap[T], event: Event<DomainEventMap[T]>) => void | Promise<void>,
  ): EventSubscription {
    const wrappedHandler: EventHandler<DomainEventMap[T]> = (event) => {
      return handler(event.payload, event);
    };
    return this.eventBus.on(type, wrappedHandler);
  }

  /**
   * Subscribe to a domain event once
   */
  once<T extends DomainEventType>(
    type: T,
    handler: (payload: DomainEventMap[T], event: Event<DomainEventMap[T]>) => void | Promise<void>,
  ): EventSubscription {
    const wrappedHandler: EventHandler<DomainEventMap[T]> = (event) => {
      return handler(event.payload, event);
    };
    return this.eventBus.once(type, wrappedHandler);
  }

  /**
   * Remove all listeners for a specific event type
   */
  removeAllListeners(type?: DomainEventType): void {
    this.eventBus.removeAllListeners(type);
  }

  /**
   * Get the number of listeners for an event type
   */
  listenerCount(type: DomainEventType): number {
    return this.eventBus.listenerCount(type);
  }

  /**
   * Get the underlying event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }
}

// Global typed event bus instance
let globalTypedEventBus: TypedEventBus | null = null;

/**
 * Get the global typed event bus instance
 */
export function getTypedEventBus(): TypedEventBus {
  if (!globalTypedEventBus) {
    globalTypedEventBus = new TypedEventBus(new EventBus());
  }
  return globalTypedEventBus;
}
