/**
 * Stub: Event Bus Service
 * Provides event publishing and subscription across platform services.
 */

export interface EventOptions {
  source?: string;
}

export class EventBusService {
  async publish(type: string, data: any, options?: EventOptions): Promise<void> {
    // Stub: no-op
  }

  async subscribe(type: string, handler: (data: any) => Promise<void>): Promise<void> {
    // Stub: no-op
  }
}
