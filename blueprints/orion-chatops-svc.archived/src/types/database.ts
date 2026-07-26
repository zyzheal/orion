/**
 * Database types for ChatOps service
 */

export interface DatabasePool {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>;
  transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T>;
}

export interface DatabaseClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number }>;
}

/**
 * EventBus types for ChatOps service
 */

export interface EventBusConnectionStatus {
  state: 'disabled' | 'disconnected' | 'fallback' | 'connected';
  message?: string;
  natsAvailable: boolean;
  reconnectAttempts: number;
}

export class EventBusError extends Error {
  code: string;
  recoverable: boolean;

  constructor(message: string, code: string, recoverable = false) {
    super(message);
    this.name = 'EventBusError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

export abstract class EventBusService {
  abstract publish(eventType: string, payload: Record<string, unknown>, metadata?: Record<string, unknown>): Promise<string>;
  abstract subscribe(eventType: string, handler: (event: any) => Promise<void>): Promise<() => Promise<void>>;
  abstract getConnectionStatus(): EventBusConnectionStatus;
  abstract isFallback(): boolean;
  abstract getMetrics(): Record<string, unknown>;
  abstract getRepositories(): { eventRepo?: any };
  on(_event: string, _handler: () => void): void {}
}
