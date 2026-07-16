/**
 * NATS 服务注册与发现
 *
 * 实现服务在 NATS 上的注册和发现机制
 */

import { EventEmitter } from 'events';
import { ServiceInstanceRepository, ServiceInstanceEntity } from '../repositories/NatsRegistryRepository';

export interface ServiceInstance {
  id: string;
  name: string;
  host: string;
  port: number;
  healthUrl?: string;
  metadata?: Record<string, any>;
  registeredAt: Date;
  lastHeartbeat: Date;
  status: 'healthy' | 'unhealthy' | 'unknown';
}

export interface NatsServiceRegistryConfig {
  heartbeatInterval?: number;
  servicePrefix?: string;
}

export class NatsServiceRegistry extends EventEmitter {
  private repo: ServiceInstanceRepository;
  private config: Required<NatsServiceRegistryConfig>;
  private heartbeatTimer?: NodeJS.Timeout;
  private isConnected: boolean = false;

  constructor(
    private natsConnection: any,
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    config: NatsServiceRegistryConfig = {},
  ) {
    super();
    this.repo = new ServiceInstanceRepository(db);
    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000,
      servicePrefix: config.servicePrefix || 'orion.services',
    };
  }

  /**
   * Initialize registry and mark as connected
   */
  async init(): Promise<void> {
    this.isConnected = true;
    this.startHeartbeat();
  }

  /**
   * Register service instance
   */
  async register(instance: Omit<ServiceInstance, 'id' | 'registeredAt' | 'lastHeartbeat' | 'status'>): Promise<ServiceInstance> {
    const id = `${instance.name}-${instance.host}-${instance.port}`;

    // Check if already registered
    const existing = await this.repo.findById(id);
    if (existing) {
      await this.repo.updateHeartbeat(id);
      const updated = await this.repo.findById(id);
      const newInstance = this.entityToInstance(updated!);
      await this.publishRegistration(newInstance);
      this.emit('instance:registered', newInstance);
      return newInstance;
    }

    const entity = await this.repo.create({
      id,
      name: instance.name,
      host: instance.host,
      port: instance.port,
      health_url: instance.healthUrl ?? null,
      metadata: instance.metadata ?? null,
      registered_at: new Date(),
      last_heartbeat: new Date(),
      status: 'unknown',
    });

    const newInstance = this.entityToInstance(entity);

    await this.publishRegistration(newInstance);
    this.startHeartbeat();
    this.emit('instance:registered', newInstance);
    return newInstance;
  }

  /**
   * Unregister service instance
   */
  async unregister(instanceId: string): Promise<void> {
    const instance = await this.repo.findById(instanceId);
    if (instance) {
      await this.publishUnregistration(this.entityToInstance(instance));
      await this.repo.deleteById(instanceId);
      this.emit('instance:unregistered', this.entityToInstance(instance));
    }
  }

  /**
   * Get service instance
   */
  async getInstance(id: string): Promise<ServiceInstance | undefined> {
    const entity = await this.repo.findById(id);
    if (!entity) return undefined;
    return this.entityToInstance(entity);
  }

  /**
   * Get instances by service name
   */
  async getInstancesByName(name: string): Promise<ServiceInstance[]> {
    const entities = await this.repo.findByName(name);
    return entities.map(e => this.entityToInstance(e));
  }

  /**
   * Get all instances
   */
  async getAllInstances(): Promise<ServiceInstance[]> {
    const result = await this.repo.findAll({ limit: 1000 });
    return result.entities.map(e => this.entityToInstance(e));
  }

  /**
   * Get healthy instances
   */
  async getHealthyInstances(name?: string): Promise<ServiceInstance[]> {
    if (name) {
      const entities = await this.repo.findHealthyByName(name);
      return entities.map(e => this.entityToInstance(e));
    }
    const entities = await this.repo.findByStatus('healthy');
    return entities.map(e => this.entityToInstance(e));
  }

  /**
   * Update heartbeat
   */
  async heartbeat(instanceId: string): Promise<void> {
    await this.repo.updateHeartbeat(instanceId);
    const instance = await this.repo.findById(instanceId);
    if (instance) {
      await this.publishRegistration(this.entityToInstance(instance));
    }
  }

  /**
   * 发布注册消息到 NATS
   */
  private async publishRegistration(instance: ServiceInstance): Promise<void> {
    if (!this.isConnected || !this.natsConnection) return;

    const subject = `${this.config.servicePrefix}.register`;
    const message = JSON.stringify({
      action: 'register',
      instance: {
        id: instance.id,
        name: instance.name,
        host: instance.host,
        port: instance.port,
        healthUrl: instance.healthUrl,
        metadata: instance.metadata,
      },
    });

    try {
      await this.natsConnection.publish(subject, new TextEncoder().encode(message));
    } catch (error) {
      this.emit('error', { action: 'register', error });
    }
  }

  /**
   * 发布注销消息到 NATS
   */
  private async publishUnregistration(instance: ServiceInstance): Promise<void> {
    if (!this.isConnected || !this.natsConnection) return;

    const subject = `${this.config.servicePrefix}.unregister`;
    const message = JSON.stringify({
      action: 'unregister',
      instanceId: instance.id,
    });

    try {
      await this.natsConnection.publish(subject, new TextEncoder().encode(message));
    } catch (error) {
      this.emit('error', { action: 'unregister', error });
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(async () => {
      const now = Date.now();
      const entities = await this.repo.findByStatus('healthy');
      for (const entity of entities) {
        const timeSinceHeartbeat = now - entity.last_heartbeat.getTime();
        if (timeSinceHeartbeat > this.config.heartbeatInterval * 2) {
          await this.repo.markUnhealthy(entity.id);
          const instance = this.entityToInstance(entity);
          instance.status = 'unhealthy';
          this.emit('instance:unhealthy', instance);
        }
      }

      await this.publishHeartbeat();
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Publish heartbeat message
   */
  private async publishHeartbeat(): Promise<void> {
    if (!this.isConnected || !this.natsConnection) return;

    const entities = await this.repo.findAll({ limit: 1000 });
    const subject = `${this.config.servicePrefix}.heartbeat`;
    const message = JSON.stringify({
      instances: entities.entities.map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        lastHeartbeat: i.last_heartbeat.toISOString(),
      })),
    });

    try {
      await this.natsConnection.publish(subject, new TextEncoder().encode(message));
    } catch (error) {
      this.emit('error', { action: 'heartbeat', error });
    }
  }

  /**
   * 设置连接状态
   */
  setConnected(connected: boolean): void {
    this.isConnected = connected;
    if (!connected) {
      this.stopHeartbeat();
    }
  }

  /**
   * Shutdown registry
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeat();

    const result = await this.repo.findAll({ limit: 1000 });
    for (const entity of result.entities) {
      await this.unregister(entity.id);
    }
  }

  private entityToInstance(entity: ServiceInstanceEntity): ServiceInstance {
    return {
      id: entity.id,
      name: entity.name,
      host: entity.host,
      port: entity.port,
      healthUrl: entity.health_url ?? undefined,
      metadata: entity.metadata ?? undefined,
      registeredAt: entity.registered_at,
      lastHeartbeat: entity.last_heartbeat,
      status: (entity.status as ServiceInstance['status']) ?? 'unknown',
    };
  }
}
