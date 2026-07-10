/**
 * Artifact Promotion Service - 5-stage state machine
 * development -> testing -> staging -> production -> released
 *
 * Task 2.38: 统一 SimpleFallbackStorage
 *   - 移除 deprecated 内存 Map/promotionHistory
 *   - 使用 SimpleFallbackStorage 做 fallback 存储
 *   - 添加 start() / stop() 生命周期方法
 *   - 错误统一使用 OrionError
 */
import { createLogger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ArtifactPromotionRepository } from '../../repositories/ArtifactPromotionRepository';
import { SimpleFallbackStorage } from '../fallback/FallbackStorageService';
import { OrionError, ErrorCode } from '../../errors';

const logger = createLogger('PromotionService');

// ==================== Storage Key Prefixes ====================

const CURRENT_STAGE_PREFIX = 'promotion:stage';
const HISTORY_PREFIX = 'promotion:history';

// ==================== Domain Types ====================

export enum PromotionStage {
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  STAGING = 'staging',
  PRODUCTION = 'production',
  RELEASED = 'released',
}

export const PROMOTION_ORDER: PromotionStage[] = [
  PromotionStage.DEVELOPMENT,
  PromotionStage.TESTING,
  PromotionStage.STAGING,
  PromotionStage.PRODUCTION,
  PromotionStage.RELEASED,
];

export interface PromotionRecord {
  id: string;
  artifactId: string;
  fromStage: PromotionStage;
  toStage: PromotionStage;
  promotedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  reason?: string;
  timestamp: Date;
}

export interface PromotionServiceError extends Error {
  code: string;
}

// ==================== PromotionService ====================

export class PromotionService {
  /** Repository-backed persistence (primary, when DB is available) */
  private promotionRepository?: ArtifactPromotionRepository;

  /** SimpleFallbackStorage instance for in-memory / DB-backed fallback */
  private storage: SimpleFallbackStorage | null = null;

  /** Whether the service is using persistent storage */
  get isPersistent(): boolean {
    return this.promotionRepository !== undefined;
  }

  /**
   * @param db - Optional DatabasePool or query interface. When provided, enables
   *             repository-backed persistence AND SimpleFallbackStorage with
   *             persistToDb=true.
   */
  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.promotionRepository = new ArtifactPromotionRepository(db);
      // Create SimpleFallbackStorage with DB persistence for cross-restart survival
      this.storage = new SimpleFallbackStorage({
        prefix: CURRENT_STAGE_PREFIX,
        maxSize: 1000,
        ttlMs: 0, // Promotions are permanent until superseded
        persistToDb: true,
        tenantId: 'global', // Promotion data is cross-tenant (artifact-level)
      });
      this.storage.start(new (require('../../repositories/FallbackStorageRepository').FallbackStorageRepository)(db as any));
    } else {
      // In-memory fallback mode: SimpleFallbackStorage without DB persistence
      this.storage = new SimpleFallbackStorage({
        prefix: CURRENT_STAGE_PREFIX,
        maxSize: 1000,
        ttlMs: 0,
        persistToDb: false,
      });
      this.storage.start();
      logger.warn('No DB provided — PromotionService running in in-memory fallback mode (data lost on restart)');
    }
  }

  // ==================== Lifecycle ====================

  /**
   * start() — 初始化 SimpleFallbackStorage 并从 DB 预热（如需要）。
   * 在服务初始化完成后调用。
   */
  async start(): Promise<void> {
    if (this.storage) {
      await this.storage.loadFromDb();
    }
  }

  /**
   * stop() — 停止服务，将 SimpleFallbackStorage 数据 flush 到 DB 并清理。
   */
  async stop(): Promise<void> {
    if (this.storage) {
      await this.storage.flushToDb();
      this.storage.stop();
    }
  }

  // ==================== Stage Management ====================

  /**
   * @deprecated Stage is now managed through promote() and persisted.
   * This method exists only for backward compatibility.
   */
  async setStage(artifactId: string, stage: PromotionStage): Promise<void> {
    await this.storage!.set(`${artifactId}:current`, stage);
    if (this.promotionRepository) {
      try {
        await this.promotionRepository.create({
          artifactId,
          fromEnv: stage,
          toEnv: stage,
          status: 'completed',
          promotedBy: 'system',
          approvedBy: null,
          approvedAt: null,
          reason: 'Initial stage set',
          createdAt: new Date(),
        });
      } catch (error) {
        logger.warn({ error }, 'Failed to persist initial stage');
      }
    }
    logger.warn('setStage() is deprecated and only affects fallback storage');
  }

  /**
   * Promote to next stage
   */
  async promote(artifactId: string, promotedBy: string, reason?: string): Promise<PromotionRecord> {
    const currentStage = await this.getCurrentStage(artifactId);

    if (currentStage === undefined) {
      throw new OrionError('Unknown stage: undefined', ErrorCode.BUSINESS_ERROR, false, { artifactId });
    }

    const currentIndex = PROMOTION_ORDER.indexOf(currentStage);

    if (currentIndex === -1) {
      throw new OrionError(`Unknown stage: ${currentStage}`, ErrorCode.BUSINESS_ERROR, false, { artifactId, stage: currentStage });
    }
    if (currentIndex >= PROMOTION_ORDER.length - 1) {
      throw new OrionError('Already at final stage', ErrorCode.STATE_CONFLICT, false, { artifactId, currentStage });
    }

    const nextStage = PROMOTION_ORDER[currentIndex + 1];

    const record: PromotionRecord = {
      id: `promo_${uuidv4()}`,
      artifactId,
      fromStage: currentStage,
      toStage: nextStage,
      promotedBy,
      reason,
      timestamp: new Date(),
    };

    // Update current stage in storage
    await this.storage!.set(`${artifactId}:current`, nextStage);

    // Append to history in storage
    const historyKey = `${artifactId}:history`;
    const existingHistory = (await this.storage!.get<PromotionRecord[]>(historyKey)) ?? [];
    existingHistory.push(record);
    await this.storage!.set(historyKey, existingHistory);

    // Persist to repository if available
    if (this.promotionRepository) {
      try {
        await this.promotionRepository.create({
          artifactId,
          fromEnv: currentStage,
          toEnv: nextStage,
          status: 'completed',
          promotedBy,
          approvedBy: null,
          approvedAt: null,
          reason: reason ?? null,
          createdAt: record.timestamp,
        });
      } catch (error) {
        logger.warn({ error, artifactId }, 'Failed to persist promotion to repository');
      }
    }

    logger.info({ artifactId, from: currentStage, to: nextStage }, 'Artifact promoted');
    return record;
  }

  /**
   * Promote with approval
   */
  async promoteWithApproval(artifactId: string, promotedBy: string, approvedBy: string, reason?: string): Promise<PromotionRecord> {
    const record = await this.promote(artifactId, promotedBy, reason);
    record.approvedBy = approvedBy;
    record.approvedAt = new Date();

    // Update repository with approval info
    if (this.promotionRepository) {
      try {
        await this.promotionRepository.approve(record.id, approvedBy);
      } catch (error) {
        logger.warn({ error, recordId: record.id }, 'Failed to persist approval');
      }
    }

    return record;
  }

  /**
   * Get current stage
   * Queries storage for the latest promotion record.
   */
  async getCurrentStage(artifactId: string): Promise<PromotionStage | undefined> {
    // Try storage first
    const stored = await this.storage!.get<PromotionStage>(`${artifactId}:current`);
    if (stored !== null) {
      return stored as PromotionStage;
    }

    // Try repository if available
    if (this.promotionRepository) {
      try {
        const entities = await this.promotionRepository.findByArtifact(artifactId);
        if (entities.length > 0) {
          const latestStage = entities[0].toEnv as PromotionStage;
          // Cache in storage for next read
          await this.storage!.set(`${artifactId}:current`, latestStage);
          return latestStage;
        }
        // No promotions yet — artifact starts at DEVELOPMENT
        await this.storage!.set(`${artifactId}:current`, PromotionStage.DEVELOPMENT);
        return PromotionStage.DEVELOPMENT;
      } catch (error) {
        logger.warn({ error, artifactId }, 'Failed to get current stage from repository');
        // In-memory mode (no repository): unknown artifacts start at DEVELOPMENT
    await this.storage!.set(`${artifactId}:current`, PromotionStage.DEVELOPMENT);
    return PromotionStage.DEVELOPMENT; // DB error → propagate undefined
      }
    }

    // In-memory mode (no repository): unknown artifacts start at DEVELOPMENT
    await this.storage!.set(`${artifactId}:current`, PromotionStage.DEVELOPMENT);
    return PromotionStage.DEVELOPMENT;
  }

  /**
   * Get promotion history
   */
  async getHistory(artifactId: string): Promise<PromotionRecord[]> {
    // Try storage first
    const storedHistory = await this.storage!.get<PromotionRecord[]>(`${artifactId}:history`);
    if (storedHistory !== null) {
      return storedHistory;
    }

    // Fallback to repository
    if (this.promotionRepository) {
      try {
        const entities = await this.promotionRepository.findByArtifact(artifactId);
        const records = entities.map((e) => ({
          id: e.id,
          artifactId: e.artifactId,
          fromStage: e.fromEnv as PromotionStage,
          toStage: e.toEnv as PromotionStage,
          promotedBy: e.promotedBy,
          approvedBy: e.approvedBy ?? undefined,
          approvedAt: e.approvedAt ?? undefined,
          reason: e.reason ?? undefined,
          timestamp: e.createdAt,
        }));
        // Cache in storage
        await this.storage!.set(`${artifactId}:history`, records);
        return records;
      } catch (error) {
        logger.warn({ error, artifactId }, 'Failed to get history from repository');
      }
    }

    return [];
  }

  /**
   * Validate if promotion from current to target stage is allowed (step-by-step only)
   */
  async canPromote(artifactId: string, toStage: PromotionStage): Promise<boolean> {
    const currentStage = await this.getCurrentStage(artifactId);
    if (!currentStage) return toStage === PromotionStage.DEVELOPMENT;

    const currentIndex = PROMOTION_ORDER.indexOf(currentStage);
    const toIndex = PROMOTION_ORDER.indexOf(toStage);

    return toIndex === currentIndex + 1;
  }
}

export default PromotionService;
