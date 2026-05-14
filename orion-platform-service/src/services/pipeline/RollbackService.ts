/**
 * RollbackService - 回滚服务
 *
 * 负责部署回滚的管理和执行。
 * 使用 PostgreSQL Repository 模式进行持久化。
 */

import { DatabasePool } from '../database';
import { RollbackRepository, RollbackEntity } from '../../repositories/RollbackRepository';
import { v4 as uuidv4 } from 'uuid';

export enum RollbackType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
  EMERGENCY = 'emergency',
  CANARY = 'canary',
}

export enum RollbackStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface RollbackInput {
  deploymentId: string;
  rollbackType: RollbackType;
  reason?: string;
  triggeredBy?: string;
  previousVersion: string;
  targetVersion: string;
}

export interface RollbackInfo {
  id: string;
  deploymentId: string;
  rollbackType: RollbackType;
  reason?: string;
  triggeredBy?: string;
  startedAt: Date;
  completedAt?: Date;
  status: RollbackStatus;
  previousVersion?: string;
  targetVersion?: string;
  errorMessage?: string;
  createdAt: Date;
}

export class RollbackService {
  private repository: RollbackRepository;

  constructor(db: DatabasePool) {
    this.repository = new RollbackRepository(db);
  }

  /**
   * 发起回滚
   */
  async initiateRollback(input: RollbackInput): Promise<RollbackInfo> {
    const id = uuidv4();
    const now = new Date();

    const entity: RollbackEntity = {
      id,
      deploymentId: input.deploymentId,
      rollbackType: input.rollbackType,
      reason: input.reason || null,
      triggeredBy: input.triggeredBy || null,
      startedAt: now,
      completedAt: null,
      status: RollbackStatus.RUNNING,
      previousVersion: input.previousVersion,
      targetVersion: input.targetVersion,
      errorMessage: null,
      createdAt: now,
    };

    await this.repository.create(entity);

    const found = await this.repository.findById(id);
    return this.entityToRollbackInfo(found as RollbackEntity);
  }

  /**
   * 更新回滚状态
   */
  async updateStatus(
    rollbackId: string,
    status: RollbackStatus,
    completedAt?: Date,
    errorMessage?: string
  ): Promise<void> {
    await this.repository.updateStatus(rollbackId, status, completedAt, errorMessage);
  }

  /**
   * 标记回滚完成
   */
  async completeRollback(rollbackId: string): Promise<void> {
    await this.updateStatus(rollbackId, RollbackStatus.COMPLETED, new Date());
  }

  /**
   * 标记回滚失败
   */
  async failRollback(rollbackId: string, error: string): Promise<void> {
    await this.updateStatus(rollbackId, RollbackStatus.FAILED, new Date(), error);
  }

  /**
   * 按部署 ID 查询回滚历史
   */
  async getByDeploymentId(deploymentId: string): Promise<RollbackInfo[]> {
    const entities = await this.repository.findByDeploymentId(deploymentId);
    return entities.map(e => this.entityToRollbackInfo(e));
  }

  /**
   * 按状态查询回滚记录
   */
  async getByStatus(status: RollbackStatus): Promise<RollbackInfo[]> {
    const entities = await this.repository.findByStatus(status);
    return entities.map(e => this.entityToRollbackInfo(e));
  }

  /**
   * 获取最近的回滚记录
   */
  async getRecent(limit: number = 100): Promise<RollbackInfo[]> {
    const entities = await this.repository.findRecent(limit);
    return entities.map(e => this.entityToRollbackInfo(e));
  }

  /**
   * 按 ID 获取回滚详情
   */
  async getById(id: string): Promise<RollbackInfo | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    return this.entityToRollbackInfo(entity);
  }

  /**
   * 执行回滚操作
   *
   * 实际生产中，这里应该调用部署服务执行回滚。
   */
  async executeRollback(input: RollbackInput): Promise<RollbackInfo> {
    // 1. 发起回滚记录
    const rollback = await this.initiateRollback(input);

    try {
      // 2. 执行回滚逻辑 (这里只是模拟，实际需要调用部署服务)
      // await deploymentService.rollback(input.deploymentId, input.targetVersion);

      // 3. 标记为完成
      await this.completeRollback(rollback.id);

      return (await this.getById(rollback.id)) as RollbackInfo;
    } catch (error) {
      // 回滚失败
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.failRollback(rollback.id, errorMessage);
      throw error;
    }
  }

  /**
   * 转换实体到服务接口
   */
  private entityToRollbackInfo(entity: RollbackEntity): RollbackInfo {
    return {
      id: entity.id,
      deploymentId: entity.deploymentId,
      rollbackType: entity.rollbackType as RollbackType,
      reason: entity.reason || undefined,
      triggeredBy: entity.triggeredBy || undefined,
      startedAt: entity.startedAt,
      completedAt: entity.completedAt || undefined,
      status: entity.status as RollbackStatus,
      previousVersion: entity.previousVersion || undefined,
      targetVersion: entity.targetVersion || undefined,
      errorMessage: entity.errorMessage || undefined,
      createdAt: entity.createdAt,
    };
  }
}

export default RollbackService;