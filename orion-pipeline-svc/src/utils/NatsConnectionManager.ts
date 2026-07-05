import { connect, JetStreamManager, NatsConnection, StringCodec } from 'nats';
import pino from 'pino';

const logger = pino({ name: 'nats-connection-manager' });

export interface NatsConfig {
  servers: string[];
  jetStreamEnabled?: boolean;
  credsFile?: string;
}

export class NatsConnectionManager {
  private connection: NatsConnection | null = null;
  private jsManager: JetStreamManager | null = null;
  private config: NatsConfig;

  constructor(config: NatsConfig) {
    this.config = config;
  }

  async connect(): Promise<NatsConnection> {
    if (this.connection && !this.connection.isClosed()) {
      return this.connection;
    }
    try {
      this.connection = await connect({
        servers: this.config.servers,
        reconnect: true,
        maxReconnectAttempts: 10,
        reconnectTimeWait: 2000,
      });
      logger.info({ servers: this.config.servers }, 'NATS connected');
      if (this.config.jetStreamEnabled) {
        this.jsManager = await this.connection.jetstreamManager();
      }
      this.monitorConnection();
      return this.connection;
    } catch (error) {
      logger.error({ error }, 'Failed to connect to NATS');
      throw error;
    }
  }

  async getJetStreamManager(): Promise<JetStreamManager> {
    if (!this.jsManager) throw new Error('JetStream not enabled');
    return this.jsManager;
  }

  async close(): Promise<void> {
    if (this.connection && !this.connection.isClosed()) {
      await this.connection.close();
      logger.info('NATS connection closed');
    }
  }

  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  /**
   * Monitor NATS connection status changes via the status async iterator.
   */
  private monitorConnection(): void {
    if (!this.connection) return;
    (async () => {
      for await (const status of this.connection!.status()) {
        if (status.type === 'disconnect') {
          logger.warn('NATS disconnected');
        } else if (status.type === 'reconnect') {
          logger.info('NATS reconnected');
        } else if (status.type === 'update') {
          logger.debug({ data: status.data }, 'NATS server update');
        }
      }
    })().catch((err) => logger.error({ err }, 'Connection monitor error'));
  }
}
