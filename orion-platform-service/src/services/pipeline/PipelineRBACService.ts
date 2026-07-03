/**
 * PipelineRBACService - Pipeline-level Role-Based Access Control
 *
 * Defines roles and permissions for pipeline operations:
 * - pipeline.admin: Full control (create, update, delete, trigger, cancel, approve)
 * - pipeline.editor: Can create, update, trigger, view
 * - pipeline.viewer: Can only view
 * - pipeline.approver: Can approve/reject approval gates
 *
 * Persistence: PostgreSQL via RBACRuleRepository.
 * In-memory cache used for fast permission checks.
 *
 * If no RBAC rules exist for a pipeline, default to allow (backward compatible).
 */

import { createLogger } from '../utils/logger';
import { RBACRuleRepository } from '../../repositories/RBACRuleRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Pipeline roles
 */
export type PipelineRole =
  | 'pipeline.admin'
  | 'pipeline.editor'
  | 'pipeline.viewer'
  | 'pipeline.approver';

/**
 * RBAC rule mapping users to roles for a specific pipeline
 */
export interface PipelineRBACRule {
  pipelineId: string;
  userId: string;
  role: PipelineRole;
}

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Role permissions mapping
 */
const ROLE_PERMISSIONS: Record<PipelineRole, string[]> = {
  'pipeline.admin': ['trigger', 'view', 'cancel', 'approve', 'create', 'update', 'delete'],
  'pipeline.editor': ['trigger', 'view', 'create', 'update'],
  'pipeline.viewer': ['view'],
  'pipeline.approver': ['approve', 'view'],
};

export class PipelineRBACService {
  private repository!: RBACRuleRepository;
  /** In-memory cache for fast permission checks. Key: pipelineId, Value: Map<userId, role> */
  private rulesCache: Map<string, Map<string, PipelineRole>> = new Map();
  private cacheInitialized = new Set<string>();

  constructor(repository?: RBACRuleRepository) {
    if (repository) {
      this.repository = repository;
    }
  }

  /**
   * Set RBAC rules for a pipeline.
   * @param pipelineId - The pipeline ID
   * @param userRules - Array of { userId, role } rules
   */
  async setRules(pipelineId: string, userRules: { userId: string; role: PipelineRole }[]): Promise<void> {
    if (this.repository) {
      await this.repository.deleteByPipelineId(pipelineId);
      for (const rule of userRules) {
        await this.repository.upsert(pipelineId, rule.userId, rule.role);
      }
    }

    // Always update in-memory cache
    const userMap = new Map<string, PipelineRole>();
    for (const rule of userRules) {
      userMap.set(rule.userId, rule.role);
    }
    this.rulesCache.set(pipelineId, userMap);
    this.cacheInitialized.add(pipelineId);
    logger.info({ pipelineId, ruleCount: userRules.length }, 'Pipeline RBAC rules set');
  }

  /**
   * Add a single RBAC rule for a pipeline.
   */
  async addRule(pipelineId: string, userId: string, role: PipelineRole): Promise<void> {
    if (this.repository) {
      await this.repository.upsert(pipelineId, userId, role);
    }

    if (!this.rulesCache.has(pipelineId)) {
      this.rulesCache.set(pipelineId, new Map());
    }
    this.rulesCache.get(pipelineId)!.set(userId, role);
    this.cacheInitialized.add(pipelineId);
    logger.debug({ pipelineId, userId, role }, 'RBAC rule added');
  }

  /**
   * Remove a rule for a pipeline.
   */
  async removeRule(pipelineId: string, userId: string): Promise<void> {
    if (this.repository) {
      await this.repository.deleteByPipelineAndUser(pipelineId, userId);
    }

    const userMap = this.rulesCache.get(pipelineId);
    if (userMap) {
      userMap.delete(userId);
      if (userMap.size === 0) {
        this.rulesCache.delete(pipelineId);
      }
    }
  }

  /**
   * Get all rules for a pipeline.
   */
  async getRules(pipelineId: string): Promise<{ userId: string; role: PipelineRole }[]> {
    await this.ensureCacheLoaded(pipelineId);
    const userMap = this.rulesCache.get(pipelineId);
    if (!userMap) return [];
    return Array.from(userMap.entries()).map(([userId, role]) => ({ userId, role }));
  }

  /**
   * Get the role of a user for a specific pipeline.
   */
  async getUserRole(pipelineId: string, userId: string): Promise<PipelineRole | null> {
    await this.ensureCacheLoaded(pipelineId);
    const userMap = this.rulesCache.get(pipelineId);
    return userMap?.get(userId) || null;
  }

  /**
   * Ensure cache is loaded from database for a pipeline.
   * On DB failure, marks dbFailed=true and continues using whatever is in cache.
   */
  private async ensureCacheLoaded(pipelineId: string): Promise<void> {
    if (this.cacheInitialized.has(pipelineId)) return;
    if (!this.repository) return; // No repository, skip DB load

    const rules = await this.repository.findByPipelineId(pipelineId);
    const userMap = new Map<string, PipelineRole>();
    for (const rule of rules) {
      userMap.set(rule.userId, rule.role as PipelineRole);
    }
    this.rulesCache.set(pipelineId, userMap);
    this.cacheInitialized.add(pipelineId);
  }

  /**
   * Check if a user has a specific permission for a pipeline.
   * If no rules exist for the pipeline, default to allow (backward compatible).
   */
  async hasPermission(pipelineId: string, userId: string, permission: string): Promise<PermissionResult> {
    await this.ensureCacheLoaded(pipelineId);
    const userMap = this.rulesCache.get(pipelineId);

    // No rules = default allow (backward compatible)
    if (!userMap || userMap.size === 0) {
      return { allowed: true, reason: 'No RBAC rules defined, defaulting to allow' };
    }

    const role = userMap.get(userId);
    if (!role) {
      return { allowed: false, reason: `User '${userId}' has no role defined for pipeline '${pipelineId}'` };
    }

    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions) {
      return { allowed: false, reason: `Unknown role: ${role}` };
    }

    if (permissions.includes(permission)) {
      return { allowed: true };
    }

    return { allowed: false, reason: `Role '${role}' does not have '${permission}' permission` };
  }

  /**
   * Check if user can trigger a pipeline.
   */
  async canTrigger(pipelineId: string, userId: string): Promise<PermissionResult> {
    return this.hasPermission(pipelineId, userId, 'trigger');
  }

  /**
   * Check if user can view a pipeline.
   */
  async canView(pipelineId: string, userId: string): Promise<PermissionResult> {
    return this.hasPermission(pipelineId, userId, 'view');
  }

  /**
   * Check if user can cancel a pipeline run.
   */
  async canCancel(runId: string, userId: string, _tenantId?: string, pipelineId?: string): Promise<PermissionResult> {
    const key = pipelineId || runId;
    return this.hasPermission(key, userId, 'cancel');
  }

  /**
   * Check if user can approve a pipeline run.
   */
  async canApprove(runId: string, userId: string, _tenantId?: string, pipelineId?: string): Promise<PermissionResult> {
    const key = pipelineId || runId;
    return this.hasPermission(key, userId, 'approve');
  }

}
