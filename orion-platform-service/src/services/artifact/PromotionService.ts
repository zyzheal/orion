/**
 * Artifact Promotion Service - 5-stage state machine
 * development -> testing -> staging -> production -> released
 */
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { ArtifactPromotionRepository } from '../../repositories/ArtifactPromotionRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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

export class PromotionService {
  private currentStages: Map<string, PromotionStage> = new Map();
  private promotionHistory: PromotionRecord[] = [];
  private promotionRepository?: ArtifactPromotionRepository;

  constructor(db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    if (db) {
      this.promotionRepository = new ArtifactPromotionRepository(db);
    }
  }

  /**
   * Set artifact current stage
   */
  setStage(artifactId: string, stage: PromotionStage): void {
    this.currentStages.set(artifactId, stage);
  }

  /**
   * Promote to next stage
   */
  async promote(artifactId: string, promotedBy: string, reason?: string): Promise<PromotionRecord> {
    const currentStage = this.currentStages.get(artifactId) || PromotionStage.DEVELOPMENT;
    const currentIndex = PROMOTION_ORDER.indexOf(currentStage);

    if (currentIndex === -1) throw Object.assign(new Error(`Unknown stage: ${currentStage}`), { code: 'UNKNOWN_STAGE' }) as PromotionServiceError;
    if (currentIndex >= PROMOTION_ORDER.length - 1) throw Object.assign(new Error('Already at final stage'), { code: 'FINAL_STAGE' }) as PromotionServiceError;

    const nextStage = PROMOTION_ORDER[currentIndex + 1];
    this.currentStages.set(artifactId, nextStage);

    const record: PromotionRecord = {
      id: `promo_${uuidv4()}`,
      artifactId,
      fromStage: currentStage,
      toStage: nextStage,
      promotedBy,
      reason,
      timestamp: new Date(),
    };
    this.promotionHistory.push(record);

    // Store in repository
    if (this.promotionRepository) {
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
      await this.promotionRepository.approve(record.id, approvedBy);
    }

    return record;
  }

  /**
   * Get current stage
   */
  getCurrentStage(artifactId: string): PromotionStage | undefined {
    return this.currentStages.get(artifactId);
  }

  /**
   * Get promotion history
   */
  async getHistory(artifactId: string): Promise<PromotionRecord[]> {
    // Load from repository if available
    if (this.promotionRepository) {
      const entities = await this.promotionRepository.findByArtifact(artifactId);
      return entities.map(e => ({
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
    }
    return this.promotionHistory.filter(r => r.artifactId === artifactId);
  }

  /**
   * Validate if promotion from current to target stage is allowed (step-by-step only)
   */
  canPromote(artifactId: string, toStage: PromotionStage): boolean {
    const currentStage = this.getCurrentStage(artifactId);
    if (!currentStage) return toStage === PromotionStage.DEVELOPMENT;

    const currentIndex = PROMOTION_ORDER.indexOf(currentStage);
    const toIndex = PROMOTION_ORDER.indexOf(toStage);

    return toIndex === currentIndex + 1;
  }
}
