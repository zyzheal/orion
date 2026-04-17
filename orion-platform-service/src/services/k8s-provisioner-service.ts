/**
 * K8s Provisioner Service
 *
 * 负责 K8s Namespace 创建、服务部署、销毁
 *
 * MVP: 模拟实现，返回模拟结果。实际实现需要 @kubernetes/client-node
 */

import pino from 'pino';
import { EphemeralEnvironment, EphemeralService } from '../models/EphemeralEnvironment';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ProvisionResult {
  namespace: string;
  services: EphemeralService[];
  previewUrl: string;
}

export class K8sProvisionerService {
  private namespaces: Map<string, boolean> = new Map();

  /**
   * 创建 Namespace 并部署服务
   */
  async provision(env: EphemeralEnvironment): Promise<ProvisionResult> {
    logger.info(
      { namespace: env.namespace, prId: env.prId },
      'Provisioning ephemeral environment'
    );

    // Create namespace
    this.namespaces.set(env.namespace, true);
    logger.info({ namespace: env.namespace }, 'Namespace created');

    // Deploy services (MVP: mock frontend + backend)
    const services: EphemeralService[] = [
      {
        name: 'frontend',
        image: `orion-frontend:${env.branchName}`,
        replicas: 1,
        healthy: true,
      },
      {
        name: 'backend',
        image: `orion-backend:${env.branchName}`,
        replicas: 1,
        healthy: true,
      },
    ];

    // Simulate deployment time
    await new Promise((r) => setTimeout(r, 100));

    logger.info(
      { namespace: env.namespace, services: services.map((s) => s.name) },
      'Services deployed'
    );

    return {
      namespace: env.namespace,
      services,
      previewUrl: env.previewUrl || `https://${env.namespace}.dev.orion.internal`,
    };
  }

  /**
   * 检查环境健康状态
   */
  async checkHealth(namespace: string): Promise<boolean> {
    return this.namespaces.get(namespace) || false;
  }

  /**
   * 销毁 Namespace 和所有资源
   */
  async teardown(namespace: string): Promise<void> {
    logger.info({ namespace }, 'Tearing down ephemeral environment');

    // Simulate teardown time
    await new Promise((r) => setTimeout(r, 100));

    this.namespaces.delete(namespace);
    logger.info({ namespace }, 'Namespace and resources destroyed');
  }

  /**
   * 列出所有活跃 namespace
   */
  listActiveNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }
}
