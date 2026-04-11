/**
 * NATS 服务注册与发现
 *
 * 实现服务在 NATS 上的注册和发现机制
 */

import { EventEmitter } from 'events';

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
  private instances: Map<string, ServiceInstance> = new Map();
  private config: Required<NatsServiceRegistryConfig>;
  private heartbeatTimer?: NodeJS.Timeout;
  private isConnected: boolean = false;

  constructor(private natsConnection: any, config: NatsServiceRegistryConfig = {}) {
    super();
    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 秒
      servicePrefix: config.servicePrefix || 'orion.services',
    };
  }

  /**
   * 注册服务实例
   */
  async register(instance: Omit<ServiceInstance, 'id' | 'registeredAt' | 'lastHeartbeat' | 'status'>): Promise<ServiceInstance> {
    const id = `${instance.name}-${instance.host}-${instance.port}`;

    const newInstance: ServiceInstance = {
      ...instance,
      id,
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'unknown' as const,
    };

    this.instances.set(id, newInstance);

    // 发布到 NATS
    await this.publishRegistration(newInstance);

    // 启动心跳
    this.startHeartbeat();

    this.emit('instance:registered', newInstance);
    return newInstance;
  }

  /**
   * 注销服务实例
   */
  async unregister(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      // 发布注销消息
      await this.publishUnregistration(instance);

      this.instances.delete(instanceId);
      this.emit('instance:unregistered', instance);

      // 如果没有实例了，停止心跳
      if (this.instances.size === 0) {
        this.stopHeartbeat();
      }
    }
  }

  /**
   * 获取服务实例
   */
  getInstance(id: string): ServiceInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * 根据服务名获取实例列表
   */
  getInstancesByName(name: string): ServiceInstance[] {
    return this.getAllInstances().filter((i) => i.name === name);
  }

  /**
   * 获取所有实例
   */
  getAllInstances(): ServiceInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * 获取健康实例
   */
  getHealthyInstances(name?: string): ServiceInstance[] {
    const instances = this.getAllInstances().filter((i) => i.status === 'healthy');
    return name ? instances.filter((i) => i.name === name) : instances;
  }

  /**
   * 更新心跳
   */
  async heartbeat(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.lastHeartbeat = new Date();
      instance.status = 'healthy';
      await this.publishRegistration(instance);
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
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(async () => {
      const now = Date.now();
      for (const [id, instance] of this.instances) {
        const timeSinceHeartbeat = now - instance.lastHeartbeat.getTime();
        if (timeSinceHeartbeat > this.config.heartbeatInterval * 2) {
          instance.status = 'unhealthy';
          this.emit('instance:unhealthy', instance);
        }
      }

      // 发送心跳消息
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
   * 发布心跳消息
   */
  private async publishHeartbeat(): Promise<void> {
    if (!this.isConnected || !this.natsConnection) return;

    const subject = `${this.config.servicePrefix}.heartbeat`;
    const message = JSON.stringify({
      instances: Array.from(this.instances.values()).map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        lastHeartbeat: i.lastHeartbeat.toISOString(),
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
   * 关闭注册表
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeat();

    // 注销所有实例
    for (const [id, instance] of this.instances) {
      await this.unregister(id);
    }

    this.instances.clear();
  }
}
