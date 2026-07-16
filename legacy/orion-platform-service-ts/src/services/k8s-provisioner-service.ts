/**
 * K8s Provisioner Service
 *
 * 负责 K8s Namespace 创建、服务部署、销毁
 *
 * MVP: 模拟实现，返回模拟结果。实际实现需要 @kubernetes/client-node
 */

import { createLogger } from '../utils/logger';
import { EphemeralEnvironment, EphemeralService } from '../models/EphemeralEnvironment';
import { K8sNamespaceRepository } from '../repositories/K8sProvisionerRepository';

const logger = createLogger('k8s-provisioner-service');

export interface ProvisionResult {
  namespace: string;
  services: EphemeralService[];
  previewUrl: string;
}

export class K8sProvisionerService {
  private repo: K8sNamespaceRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repo = new K8sNamespaceRepository(db);
  }

  /**
   * Create Namespace and deploy services
   */
  async provision(env: EphemeralEnvironment): Promise<ProvisionResult> {
    logger.info(
      { namespace: env.namespace, prId: env.prId },
      'Provisioning ephemeral environment'
    );

    // Create namespace record
    await this.repo.create({
      namespace: env.namespace,
      pr_id: env.prId ?? null,
      branch_name: env.branchName ?? null,
      status: 'active',
      preview_url: env.previewUrl ?? null,
      destroyed_at: null,
    });
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
   * Check environment health status
   */
  async checkHealth(namespace: string): Promise<boolean> {
    const entity = await this.repo.findByNamespace(namespace);
    return entity ? entity.status === 'active' : false;
  }

  /**
   * Destroy Namespace and all resources
   */
  async teardown(namespace: string): Promise<void> {
    logger.info({ namespace }, 'Tearing down ephemeral environment');

    const entity = await this.repo.findByNamespace(namespace);
    if (entity) {
      await this.repo.markDestroyed(entity.id);
    }

    // Simulate teardown time
    await new Promise((r) => setTimeout(r, 100));

    logger.info({ namespace }, 'Namespace and resources destroyed');
  }

  /**
   * List all active namespaces
   */
  async listActiveNamespaces(): Promise<string[]> {
    const entities = await this.repo.findActive();
    return entities.map(e => e.namespace);
  }
}
