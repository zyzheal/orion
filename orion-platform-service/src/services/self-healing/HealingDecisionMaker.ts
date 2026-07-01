/**
 * Healing Decision Maker
 *
 * Determines whether to auto-heal or require manual approval based on
 * confidence scores, risk assessment, and environmental factors.
 * Manages the approval workflow for manual interventions.
 *
 * TASK-702: Self-Healing Engine (自愈引擎)
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../errors';
import { HealingApprovalRequestRepository } from '../../repositories/HealingApprovalRequestRepository';
import {
  HealingStrategy,
  HealingAction,
  HealingDecision,
  ApprovalRequest,
  ApprovalResponse,
  DecisionType,
  RiskLevel,
  IncidentSeverity,
  IncidentType,
} from './types';
import { DatabasePool } from '../../services/database';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'LHealing-LDecision-LMaker' });

/**
 * Risk assessment integration interface
 */
export interface IRiskAssessor {
  assessRisk(
    appName: string,
    environment: string,
    actionType: string
  ): Promise<{ riskLevel: RiskLevel; riskScore: number }>;
}

/**
 * Decision maker configuration
 */
export interface DecisionMakerConfig {
  /** Minimum confidence score for auto-healing (0-100) */
  autoHealConfidenceThreshold?: number;
  /** Maximum risk level for auto-healing */
  maxAutoHealRiskLevel?: RiskLevel;
  /** Auto-heal disabled for these environments */
  disabledEnvironments?: string[];
  /** Auto-heal disabled for these incident types */
  disabledIncidentTypes?: IncidentType[];
  /** Approval expiration time (ms) */
  approvalExpirationMs?: number;
}

const DEFAULT_CONFIG: Required<DecisionMakerConfig> = {
  autoHealConfidenceThreshold: 70,
  maxAutoHealRiskLevel: 'medium',
  disabledEnvironments: ['production', 'prod'],
  disabledIncidentTypes: [],
  approvalExpirationMs: 300000, // 5 minutes
};

const RISK_LEVEL_SCORES: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export class HealingDecisionMaker {
  private config: Required<DecisionMakerConfig>;
  private riskAssessor?: IRiskAssessor;
  private repository: HealingApprovalRequestRepository;

  constructor(
    config?: DecisionMakerConfig,
    riskAssessor?: IRiskAssessor,
    db: DatabasePool = null as any,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.riskAssessor = riskAssessor;
    if (!db) throw new Error('DatabasePool is required for HealingDecisionMaker');
    this.repository = new HealingApprovalRequestRepository(db);
  }

  /**
   * Determine whether to auto-heal or require manual approval
   */
  async getDecision(params: {
    strategy: HealingStrategy;
    appName: string;
    environment: string;
    incidentType: IncidentType;
    severity: IncidentSeverity;
    tags?: Record<string, string>;
  }): Promise<HealingDecision> {
    const { strategy, appName, environment, incidentType, severity } = params;

    // Check if auto-healing is disabled for this environment
    if (this.config.disabledEnvironments.includes(environment)) {
      return {
        type: 'manual',
        reason: `Auto-healing is disabled for environment: ${environment}`,
        confidence: strategy.confidence,
        riskLevel: 'high',
        requiresApproval: true,
        recommendedActions: strategy.actions,
      };
    }

    // Check if auto-healing is disabled for this incident type
    if (this.config.disabledIncidentTypes.includes(incidentType)) {
      return {
        type: 'manual',
        reason: `Auto-healing is disabled for incident type: ${incidentType}`,
        confidence: strategy.confidence,
        riskLevel: 'high',
        requiresApproval: true,
        recommendedActions: strategy.actions,
      };
    }

    // Check strategy confidence threshold
    if (strategy.confidence < this.config.autoHealConfidenceThreshold) {
      return {
        type: 'manual',
        reason: `Strategy confidence (${strategy.confidence}%) is below threshold (${this.config.autoHealConfidenceThreshold}%)`,
        confidence: strategy.confidence,
        riskLevel: 'medium',
        requiresApproval: true,
        recommendedActions: strategy.actions,
      };
    }

    // Assess risk
    const riskAssessment = await this.assessRisk(
      appName,
      environment,
      strategy
    );

    // Check if risk level is too high for auto-healing
    if (
      RISK_LEVEL_SCORES[riskAssessment.riskLevel] >
      RISK_LEVEL_SCORES[this.config.maxAutoHealRiskLevel]
    ) {
      return {
        type: 'manual',
        reason: `Risk level '${riskAssessment.riskLevel}' exceeds maximum auto-heal risk level '${this.config.maxAutoHealRiskLevel}'`,
        confidence: strategy.confidence,
        riskLevel: riskAssessment.riskLevel,
        requiresApproval: true,
        recommendedActions: strategy.actions,
      };
    }

    // Critical severity always requires manual review
    if (severity === 'critical') {
      return {
        type: 'manual',
        reason: 'Critical severity incidents require manual review',
        confidence: strategy.confidence,
        riskLevel: riskAssessment.riskLevel,
        requiresApproval: true,
        recommendedActions: strategy.actions,
      };
    }

    // All checks passed - auto-heal is approved
    return {
      type: 'auto',
      reason: 'Confidence and risk levels within auto-heal thresholds',
      confidence: strategy.confidence,
      riskLevel: riskAssessment.riskLevel,
      requiresApproval: false,
      recommendedActions: strategy.actions,
    };
  }

  /**
   * Quick check if auto-healing should be used
   */
  async shouldAutoHeal(params: {
    strategy: HealingStrategy;
    appName: string;
    environment: string;
    incidentType: IncidentType;
    severity: IncidentSeverity;
    tags?: Record<string, string>;
  }): Promise<boolean> {
    const decision = await this.getDecision(params);
    return decision.type === 'auto';
  }

  /**
   * Create an approval request for manual intervention
   */
  async createApprovalRequest(params: {
    incidentId: string;
    decision: HealingDecision;
    appName: string;
    environment: string;
    incidentType: IncidentType;
    requestedBy?: string;
  }): Promise<ApprovalRequest> {
    const now = new Date();
    const id = uuidv4();

    await this.repository.create({
      id,
      incidentId: params.incidentId,
      title: `Self-Healing Approval: ${params.incidentType} in ${params.appName}`,
      description: `Auto-healing ${
        params.decision.type === 'manual' ? 'requires approval' : 'is disabled'
      } for incident in ${params.appName} (${params.environment}). ${params.decision.reason}`,
      riskLevel: params.decision.riskLevel,
      recommendedActions: params.decision.recommendedActions,
      status: 'pending',
      requestedBy: params.requestedBy || 'system',
      requestedAt: now,
      expiresAt: new Date(now.getTime() + this.config.approvalExpirationMs) || null,
    });

    const entity = await this.repository.findById(id);
    if (!entity) throw new Error(`Approval request not found: ${id}`);
    return this.entityToApprovalRequest(entity);
  }

  /**
   * Respond to an approval request
   */
  async respondToApproval(
    requestId: string,
    response: ApprovalResponse
  ): Promise<ApprovalRequest> {
    const entity = await this.repository.findById(requestId);
    if (!entity) {
      throw new OrionError(`Approval request '${requestId}' not found`, ErrorCode.NOT_FOUND);
    }

    if (entity.status !== 'pending') {
      throw new OrionError('Approval request is not pending', ErrorCode.VALIDATION_ERROR);
    }

    // Check expiration
    if (entity.expiresAt && new Date() > entity.expiresAt) {
      await this.repository.updateStatus(requestId, 'expired');
      throw new OrionError(`Approval request '${requestId}' has expired`, 'OPERATION_FAILED');
    }

    const updated = await this.repository.updateStatus(
      requestId,
      response.approved ? 'approved' : 'rejected',
      response.respondedBy,
      response.reason
    );

    return this.entityToApprovalRequest(updated);
  }

  /**
   * Get an approval request by ID
   */
  async getApprovalRequest(requestId: string): Promise<ApprovalRequest | undefined> {
    const entity = await this.repository.findById(requestId);
    if (!entity) return undefined;
    return this.entityToApprovalRequest(entity);
  }

  /**
   * Get all approval requests, optionally filtered by status
   */
  async getApprovalRequests(status?: ApprovalRequest['status']): Promise<ApprovalRequest[]> {
    let entities;
    if (status) {
      entities = await this.repository.findByStatus(status);
    } else {
      entities = (await this.repository.findAll({ limit: 1000 })).entities;
    }
    return entities.map(e => this.entityToApprovalRequest(e));
  }

  /**
   * Mark expired requests in the database
   */
  async checkExpiredRequests(): Promise<number> {
    // Use a large limit to fetch all pending requests
    const pending = await this.repository.findByStatus('pending', 10000);
    const now = new Date();
    let count = 0;
    for (const entity of pending) {
      if (entity.expiresAt && now >= entity.expiresAt) {
        await this.repository.updateStatus(entity.id, 'expired');
        count++;
      }
    }
    return count;
  }

  /**
   * Delete responded requests older than threshold
   */
  async clearExpiredRequests(maxAgeMs: number = 3600000): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs);
    const entities = (await this.repository.findAll({ limit: 10000 })).entities;
    let count = 0;
    for (const entity of entities) {
      if (entity.respondedAt && entity.respondedAt < cutoff) {
        await this.repository.delete(entity.id);
        count++;
      }
    }
    return count;
  }

  private entityToApprovalRequest(entity: import('../../repositories/HealingApprovalRequestRepository').HealingApprovalRequestEntity): ApprovalRequest {
    return {
      id: entity.id,
      incidentId: entity.incidentId,
      title: entity.title || '',
      description: entity.description || '',
      riskLevel: (entity.riskLevel as RiskLevel) || 'medium',
      recommendedActions: entity.recommendedActions || [],
      status: entity.status as ApprovalRequest['status'],
      requestedBy: entity.requestedBy || 'system',
      requestedAt: entity.requestedAt,
      expiresAt: entity.expiresAt || undefined,
      approvedBy: entity.approvedBy || undefined,
      approvalReason: entity.approvalReason || undefined,
      respondedAt: entity.respondedAt || undefined,
    };
  }

  // ==================== Private Methods ====================

  /**
   * Assess risk for the proposed healing action
   */
  private async assessRisk(
    appName: string,
    environment: string,
    strategy: HealingStrategy
  ): Promise<{ riskLevel: RiskLevel; riskScore: number }> {
    // If risk assessor is available, use it
    if (this.riskAssessor) {
      try {
        const actionType = strategy.actions[0]?.type || 'unknown';
        return await this.riskAssessor.assessRisk(
          appName,
          environment,
          actionType
        );
      } catch (error) {
        logger.warn(
          `[HealingDecisionMaker] Risk assessment failed, using default:`,
          error
        );
      }
    }

    // Default risk assessment based on environment and action types
    const envRisk = this.getEnvironmentRisk(environment);
    const actionRisk = this.getActionRisk(strategy.actions);

    const combinedScore = Math.round((envRisk + actionRisk) / 2);

    return {
      riskLevel: this.scoreToRiskLevel(combinedScore),
      riskScore: combinedScore,
    };
  }

  /**
   * Get risk score based on environment
   */
  private getEnvironmentRisk(environment: string): number {
    const env = environment.toLowerCase();
    switch (env) {
      case 'production':
      case 'prod':
        return 80;
      case 'staging':
      case 'pre-prod':
        return 50;
      case 'qa':
      case 'testing':
        return 30;
      case 'dev':
      case 'development':
        return 10;
      default:
        return 40;
    }
  }

  /**
   * Get risk score based on action types
   */
  private getActionRisk(actions: HealingAction[]): number {
    const actionRiskScores: Record<string, number> = {
      restart: 30,
      scale: 40,
      failover: 60,
      rollback: 50,
    };

    if (actions.length === 0) return 50;

    // Average risk of all actions, weighted by position (first action is most impactful)
    let totalRisk = 0;
    for (let i = 0; i < actions.length; i++) {
      const weight = 1 / (i + 1); // First action gets full weight
      const risk = actionRiskScores[actions[i].type] ?? 50;
      totalRisk += risk * weight;
    }

    return Math.round(totalRisk / actions.length);
  }

  /**
   * Convert risk score (0-100) to risk level
   */
  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }
}
