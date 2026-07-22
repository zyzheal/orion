/**
 * NATS type stubs for optional dependency
 */
declare module 'nats' {
  export interface ConnectionOptions {
    servers?: string[];
    url?: string;
    name?: string;
    user?: string;
    pass?: string;
    token?: string;
    maxReconnectAttempts?: number;
    reconnectTimeWait?: number;
    timeout?: number;
    reconnect?: boolean;
  }

  export interface Connection {
    close(): Promise<void>;
    publish(subject: string, data?: Uint8Array): void;
    subscribe(subject: string, callback?: (msg: any) => void): any;
    flush(): Promise<void>;
  }

  export function connect(options?: ConnectionOptions): Promise<Connection>;
}