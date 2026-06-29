/**
 * PipelineRBACService - Pipeline-level Role-Based Access Control
 *
 * Defines roles and permissions for pipeline operations:
 * - pipeline.admin: Full control (create, update, delete, trigger, cancel, approve)
 * - pipeline.editor: Can create, update, trigger, view
 * - pipeline.viewer: Can only view
 * - pipeline.approver: Can approve/reject approval gates
 *
 * Persistence: PostgreSQL via RBACRuleRepository with graceful degradation
 * to in-memory cache on DB failure.
 *
 * If no RBAC rules exist for a pipeline, default to allow (backward compatible).
 */

import pino from 'pino';
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
  private repository: RBACRuleRepository | null = null;
  /** Database pool reference for graceful degradation fallback */
  private dbPool: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null = null;
  /** In-memory cache for fast permission checks. Key: pipelineId, Value: Map<userId, role> */
  private rulesCache: Map<string, Map<string, PipelineRole>> = new Map();
  private cacheInitialized = new Set<string>();
  /** Whether DB operations have failed — triggers fallback mode */
  private dbFailed = false;

  /**
   * Constructor accepting either a Repository or a raw DB pool.
   * If a Repository is provided, it is stored directly.
   * If a raw pool is provided, a wrapper Repository is created internally.
   * @param dataSource — RBACRuleRepository instance or raw database pool
   */
  constructor(dataSource?: RBACRuleRepository | { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> } | null) {
    if (dataSource && 'findByPipelineId' in dataSource && typeof (dataSource as RBACRuleRepository).findByPipelineId === 'function') {
      this.repository = dataSource as RBACRuleRepository;
    } else if (dataSource && 'query' in dataSource) {
      this.dbPool = dataSource as typeof this.dbPool;
    }
  }

  /**
   * Get the effective repository — fall back to raw pool queries if repo is not available.
   * Returns null when neither repo nor pool is configured.
   */
  private getEffectiveRepo(): RBACRuleRepository | null {
    if (this.repository) return this.repository;
    if (this.dbPool) {
      // Create an on-the-fly repository wrapping the raw pool
      if (!this._fallbackRepo) {
        this._fallbackRepo = new RBACRuleRepository(this.dbPool);
      }
      return this._fallbackRepo;
    }
    return null;
  }
  private _fallbackRepo: RBACRuleRepository | null = null;

  /**
   * Execute a DB operation with automatic failure detection.
   * On failure, marks dbFailed=true and falls back to in-memory cache.
   */
  private async safeDB<T>(fn: (repo: RBACRuleRepository) => Promise<T>): Promise<{ success: boolean; data?: T }> {
    if (this.dbFailed) {
      logger.warn('DB marked as failed, skipping database operation');
      return { success: false };
    }

    try {
      const repo = this.getEffectiveRepo();
      if (!repo) {
        return { success: false };
      }
      const data = await fn(repo);
      return { success: true, data };
    } catch (err) {
      this.dbFailed = true;
      logger.error({ err }, 'DB operation failed for Pipeline RBAC, falling back to in-memory cache');
      return { success: false };
    }
  }

  /**
   * Set RBAC rules for a pipeline.
   * @param pipelineId - The pipeline ID
   * @param userRules - Array of { userId, role } rules
   */
  async setRules(pipelineId: string, userRules: { userId: string; role: PipelineRole }[]): Promise<void> {
    // Persist to DB with graceful degradation
    await this.safeDB(async repo => {
      await repo.deleteByPipelineId(pipelineId);
      for (const rule of userRules) {
        await repo.upsert(pipelineId, rule.userId, rule.role);
      }
    });

    // Always update in-memory cache (authoritative)
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
    await this.safeDB(async repo => {
      await repo.upsert(pipelineId, userId, role);
    });

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
    await this.safeDB(async repo => {
      await repo.deleteByPipelineAndUser(pipelineId, userId);
    });

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

    const result = await this.safeDB(async repo => {
      return repo.findByPipelineId(pipelineId);
    });

    if (result.success && result.data) {
      const userMap = new Map<string, PipelineRole>();
      for (const rule of result.data) {
        userMap.set(rule.userId, rule.role as PipelineRole);
      }
      this.rulesCache.set(pipelineId, userMap);
      this.cacheInitialized.add(pipelineId);
    } else if (result.success === false && !this.dbFailed) {
      // DB failed during ensureCacheLoaded — leave cache empty, defaults to allow
      logger.info({ pipelineId }, 'Pipeline RBAC cache miss after DB fallback, defaulting to allow');
    }
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

  /**
   * Reset the dbFailed flag (call after DB is restored).
   */
  resetDBFailure(): void {
    this.dbFailed = false;
    logger.info('Pipeline RBAC DB failure flag reset');
  }
}
