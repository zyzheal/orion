/**
 * Ephemeral Environment Service
 *
 * 负责临时开发环境的完整生命周期：
 * - 创建环境（Namespace + 服务部署）
 * - 查询环境列表和详情
 * - 唤醒空闲环境
 * - 销毁环境
 * - 计算环境使用成本
 */

import pino from 'pino';
import {
  EphemeralEnvironment,
  EphemeralEnvCreateInput,
  EphemeralEnvStatus,
  createEphemeralEnvironment,
  markRunning,
  markIdle,
  markTearingDown,
  markDestroyed,
  wakeEnvironment,
} from '../models/EphemeralEnvironment';
import { K8sProvisionerService } from './k8s-provisioner-service';
import { EventBusService } from './event-bus-service';
import { DatabasePool } from './database';
import { EphemeralEnvRepository } from './ephemeral-env/EphemeralEnvRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Cost rates per hour (MVP: simplified pricing)
const COST_RATES = {
  cpuPerCoreHour: 0.05,     // $0.05 per CPU core per hour
  memoryPerGiHour: 0.01,    // $0.01 per GiB per hour
  storagePerGiHour: 0.002,  // $0.002 per GiB per hour
};

export class EphemeralEnvService {
  private repository: EphemeralEnvRepository;
  private k8sProvisioner: K8sProvisionerService;
  private eventBus?: EventBusService;

  constructor(options: {
    k8sProvisioner: K8sProvisionerService;
    eventBus?: EventBusService;
    database?: DatabasePool;
  }) {
    this.k8sProvisioner = options.k8sProvisioner;
    this.eventBus = options.eventBus;
    if (!options.database) {
      throw new Error('EphemeralEnvService requires a database connection');
    }
    this.repository = new EphemeralEnvRepository(options.database);
  }

  /**
   * 创建临时环境
   */
  async create(input: EphemeralEnvCreateInput): Promise<EphemeralEnvironment> {
    logger.info(
      { prId: input.prId, repoId: input.repoId, branch: input.branchName },
      'Creating ephemeral environment'
    );

    // Check for duplicate PR
    const existing = await this.repository.findByPrAndRepo(input.prId, input.repoId, ['destroyed']);
    if (existing) {
      throw new Error(
        `Ephemeral environment already exists for PR ${input.prId} in ${input.repoId} (status: ${existing.status})`
      );
    }

    const env = createEphemeralEnvironment(input);
    await this.repository.create(input, env);

    await this.publishEvent('ephemeral-env.created', {
      envId: env.id,
      prId: env.prId,
      namespace: env.namespace,
    });

    // Provision K8s resources
    try {
      const result = await this.k8sProvisioner.provision(env);
      markRunning(env, result.services);
      env.previewUrl = result.previewUrl;

      await this.repository.update(env.id, {
        status: 'running',
        previewUrl: env.previewUrl,
        services: env.services,
      });

      await this.publishEvent('ephemeral-env.provisioned', {
        envId: env.id,
        previewUrl: env.previewUrl,
      });

      logger.info(
        { envId: env.id, previewUrl: env.previewUrl },
        'Ephemeral environment provisioned'
      );
    } catch (error) {
      logger.error({ envId: env.id, error }, 'Provisioning failed');
      markTearingDown(env, 'provisioning_failed');
      markDestroyed(env, 'provisioning_failed');
      throw error;
    }

    return env;
  }

  /**
   * 列出环境
   */
  async list(options?: {
    prId?: string;
    repoId?: string;
    statusFilter?: EphemeralEnvStatus;
  }): Promise<EphemeralEnvironment[]> {
    return this.repository.findAll(options);
  }

  /**
   * 获取环境详情
   */
  async getById(id: string): Promise<EphemeralEnvironment> {
    const env = await this.repository.findById(id);
    if (!env) {
      throw new Error(`Ephemeral environment "${id}" not found`);
    }
    return env;
  }

  /**
   * 唤醒空闲环境
   */
  async wake(id: string): Promise<EphemeralEnvironment> {
    const env = await this.getById(id);
    if (env.status !== 'idle') {
      throw new Error(`Environment is not idle (status: ${env.status})`);
    }

    wakeEnvironment(env);
    await this.repository.update(id, { status: 'running', idleSince: undefined });

    await this.publishEvent('ephemeral-env.woken', { envId: env.id });
    logger.info({ envId: env.id }, 'Environment woken up');
    return env;
  }

  /**
   * 销毁环境
   */
  async teardown(id: string, reason: string = 'manual'): Promise<EphemeralEnvironment> {
    const env = await this.getById(id);

    if (env.status === 'destroyed') {
      throw new Error(`Environment already destroyed`);
    }

    markTearingDown(env, reason);
    await this.repository.update(id, { status: 'tearing_down', destroyReason: reason });

    try {
      // Teardown K8s resources
      await this.k8sProvisioner.teardown(env.namespace);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown K8s teardown error';
      logger.error({ envId: env.id, error: message }, 'K8s teardown failed, resetting status');
      await this.repository.update(id, { status: 'idle' });
      throw new Error(`Failed to teardown K8s resources: ${message}`);
    }

    markDestroyed(env, reason);
    await this.repository.update(id, {
      status: 'destroyed',
      destroyReason: reason,
      destroyedAt: env.destroyedAt,
    });

    await this.publishEvent('ephemeral-env.destroyed', {
      envId: env.id,
      reason,
      namespace: env.namespace,
    });

    logger.info({ envId: env.id, reason }, 'Environment destroyed');
    return env;
  }

  /**
   * 自动销毁空闲超时的环境
   */
  async cleanupIdleEnvironments(maxIdleHours: number = 2): Promise<string[]> {
    const cutoff = new Date(Date.now() - maxIdleHours * 60 * 60 * 1000);
    const toDestroy = await this.repository.findIdleBefore(cutoff);

    const destroyed: string[] = [];
    for (const env of toDestroy) {
      try {
        await this.teardown(env.id, 'idle_timeout');
        destroyed.push(env.id);
      } catch (error) {
        logger.error({ envId: env.id, error }, 'Failed to cleanup idle environment');
      }
    }

    return destroyed;
  }

  /**
   * 获取 Preview URL
   */
  async getPreviewUrl(id: string): Promise<string> {
    const env = await this.getById(id);
    if (!env.previewUrl) {
      throw new Error('Preview URL not available');
    }
    return env.previewUrl;
  }

  /**
   * 检查环境健康
   */
  async checkHealth(id: string): Promise<{ healthy: boolean; message: string }> {
    const env = await this.getById(id);
    const nsHealthy = await this.k8sProvisioner.checkHealth(env.namespace);

    return {
      healthy: nsHealthy && env.status === 'running',
      message: nsHealthy ? 'All services healthy' : 'Namespace not found',
    };
  }

  /**
   * 计算环境使用成本
   *
   * 基于资源配置和运行时长计算基本成本
   */
  async getCost(id: string): Promise<{
    totalCost: number;
    breakdown: {
      cpuCost: number;
      memoryCost: number;
      storageCost: number;
    };
    durationHours: number;
  }> {
    const env = await this.getById(id);

    const endTime = env.destroyedAt || env.autoDestroyAt || new Date();
    const durationMs = endTime.getTime() - env.createdAt.getTime();
    const durationHours = Math.max(durationMs / (1000 * 60 * 60), 0.01); // minimum 0.01 hours

    const cpuCores = parseFloat(env.resources.cpu) || 2;
    const memoryGi = parseFloat(env.resources.memory) || 4;
    const storageGi = parseFloat(env.resources.storage) || 10;

    const cpuCost = cpuCores * COST_RATES.cpuPerCoreHour * durationHours;
    const memoryCost = memoryGi * COST_RATES.memoryPerGiHour * durationHours;
    const storageCost = storageGi * COST_RATES.storagePerGiHour * durationHours;

    return {
      totalCost: cpuCost + memoryCost + storageCost,
      breakdown: {
        cpuCost,
        memoryCost,
        storageCost,
      },
      durationHours,
    };
  }

  /**
   * 设置环境为空闲状态
   */
  async setIdle(id: string): Promise<EphemeralEnvironment> {
    const env = await this.getById(id);

    if (env.status !== 'running') {
      throw new Error(`Environment must be running to set idle (status: ${env.status})`);
    }

    markIdle(env);
    await this.repository.update(id, { status: 'idle', idleSince: env.idleSince! });
    logger.info({ envId: env.id }, 'Environment marked as idle');
    return env;
  }

  /**
   * 发布事件
   */
  private async publishEvent(type: string, data: unknown): Promise<void> {
    if (this.eventBus) {
      try {
        await this.eventBus.publish(type, data, { source: 'ephemeral-env-service' });
      } catch (err) {
        logger.error({ err }, 'Failed to publish ephemeral-env event');
      }
    }
  }
}
