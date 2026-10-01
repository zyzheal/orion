/**
 * 服务注册与发现
 *
 * 实现服务的自动注册和发现机制
 */

import { EventEmitter } from 'events';

export interface ServiceInfo {
  name: string;
  url: string;
  healthUrl?: string;
  metadata?: Record<string, any>;
  registeredAt: Date;
  lastHeartbeat: Date;
  status: 'healthy' | 'unhealthy' | 'unknown';
}

export interface ServiceRegistryConfig {
  heartbeatInterval?: number;
  healthCheckInterval?: number;
  unhealthyThreshold?: number;
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInfo> = new Map();
  private config: Required<ServiceRegistryConfig>;
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ServiceRegistryConfig = {}) {
    super();
    this.config = {
      heartbeatInterval: config.heartbeatInterval || 30000, // 30 秒
      healthCheckInterval: config.healthCheckInterval || 60000, // 60 秒
      unhealthyThreshold: config.unhealthyThreshold || 3, // 3 次失败标记为不健康
    };
  }

  /**
   * 注册服务
   */
  register(service: Omit<ServiceInfo, 'registeredAt' | 'lastHeartbeat' | 'status'>): ServiceInfo {
    const existing = this.services.get(service.name);

    if (existing) {
      // 更新现有服务
      const updated: ServiceInfo = {
        ...existing,
        ...service,
        lastHeartbeat: new Date(),
        status: 'healthy' as const,
      };
      this.services.set(service.name, updated);
      this.emit('service:updated', updated);
      return updated;
    }

    // 注册新服务
    const newService: ServiceInfo = {
      ...service,
      registeredAt: new Date(),
      lastHeartbeat: new Date(),
      status: 'unknown' as const,
    };
    this.services.set(service.name, newService);

    // 启动心跳检测
    this.startHeartbeat(service.name);

    // 启动健康检查
    this.startHealthCheck(service.name);

    this.emit('service:registered', newService);
    return newService;
  }

  /**
   * 注销服务
   */
  unregister(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (service) {
      this.stopHeartbeat(serviceName);
      this.stopHealthCheck(serviceName);
      this.services.delete(serviceName);
      this.emit('service:unregistered', service);
    }
  }

  /**
   * 获取服务
   */
  getService(name: string): ServiceInfo | undefined {
    return this.services.get(name);
  }

  /**
   * 获取所有服务
   */
  getAllServices(): ServiceInfo[] {
    return Array.from(this.services.values());
  }

  /**
   * 获取健康的服务列表
   */
  getHealthyServices(): ServiceInfo[] {
    return this.getAllServices().filter((s) => s.status === 'healthy');
  }

  /**
   * 根据名称获取健康服务（支持负载均衡）
   */
  getHealthyService(name: string): ServiceInfo | undefined {
    const service = this.services.get(name);
    if (service && service.status === 'healthy') {
      return service;
    }
    return undefined;
  }

  /**
   * 更新服务心跳
   */
  async heartbeat(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (service) {
      service.lastHeartbeat = new Date();
      service.status = 'healthy';
      this.emit('service:heartbeat', service);
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(serviceName: string): void {
    const timer = setInterval(() => {
      const service = this.services.get(serviceName);
      if (service) {
        const timeSinceLastHeartbeat = Date.now() - service.lastHeartbeat.getTime();
        if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
          service.status = 'unhealthy';
          this.emit('service:unhealthy', service);
        }
      }
    }, this.config.heartbeatInterval);

    this.heartbeatTimers.set(serviceName, timer);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(serviceName: string): void {
    const timer = this.heartbeatTimers.get(serviceName);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(serviceName);
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(serviceName: string): void {
    const timer = setInterval(async () => {
      const service = this.services.get(serviceName);
      if (service && service.healthUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(service.healthUrl, {
            method: 'GET',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            service.status = 'healthy';
            service.lastHeartbeat = new Date();
            this.emit('service:healthcheck:passed', service);
          } else {
            this.markUnhealthy(service);
          }
        } catch (error) {
          this.markUnhealthy(service);
        }
      }
    }, this.config.healthCheckInterval);

    this.healthCheckTimers.set(serviceName, timer);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(serviceName: string): void {
    const timer = this.healthCheckTimers.get(serviceName);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(serviceName);
    }
  }

  /**
   * 标记服务为不健康
   */
  private markUnhealthy(service: ServiceInfo): void {
    const failureCount = (service.metadata as any)?._failureCount || 0;
    const newFailureCount = failureCount + 1;

    if (service.metadata) {
      service.metadata._failureCount = newFailureCount;
    }

    if (newFailureCount >= this.config.unhealthyThreshold) {
      service.status = 'unhealthy';
      this.emit('service:healthcheck:failed', service);
    }
  }

  /**
   * 关闭注册表
   */
  shutdown(): void {
    for (const [name, timer] of this.heartbeatTimers) {
      clearInterval(timer);
    }
    for (const [name, timer] of this.healthCheckTimers) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();
    this.healthCheckTimers.clear();
    this.services.clear();
  }
}

export const serviceRegistry = new ServiceRegistry();
