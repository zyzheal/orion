/**
 * PipelineRBACService - Pipeline-level Role-Based Access Control
 *
 * Defines roles and permissions for pipeline operations:
 * - pipeline.admin: Full control (create, update, delete, trigger, cancel, approve)
 * - pipeline.editor: Can create, update, trigger, view
 * - pipeline.viewer: Can only view
 * - pipeline.approver: Can approve/reject approval gates
 *
 * If no RBAC rules exist for a pipeline, default to allow (backward compatible).
 */

import pino from 'pino';

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
  /** In-memory rule store. Key: pipelineId, Value: Map<userId, role> */
  private rules: Map<string, Map<string, PipelineRole>> = new Map();

  /**
   * Set RBAC rules for a pipeline.
   * @param pipelineId - The pipeline ID
   * @param userRules - Array of { userId, role } rules
   */
  setRules(pipelineId: string, userRules: { userId: string; role: PipelineRole }[]): void {
    const userMap = new Map<string, PipelineRole>();
    for (const rule of userRules) {
      userMap.set(rule.userId, rule.role);
    }
    this.rules.set(pipelineId, userMap);
    logger.info({ pipelineId, ruleCount: userRules.length }, 'Pipeline RBAC rules set');
  }

  /**
   * Add a single RBAC rule for a pipeline.
   */
  addRule(pipelineId: string, userId: string, role: PipelineRole): void {
    if (!this.rules.has(pipelineId)) {
      this.rules.set(pipelineId, new Map());
    }
    this.rules.get(pipelineId)!.set(userId, role);
    logger.debug({ pipelineId, userId, role }, 'RBAC rule added');
  }

  /**
   * Remove a rule for a pipeline.
   */
  removeRule(pipelineId: string, userId: string): void {
    const userMap = this.rules.get(pipelineId);
    if (userMap) {
      userMap.delete(userId);
      if (userMap.size === 0) {
        this.rules.delete(pipelineId);
      }
    }
  }

  /**
   * Get all rules for a pipeline.
   */
  getRules(pipelineId: string): { userId: string; role: PipelineRole }[] {
    const userMap = this.rules.get(pipelineId);
    if (!userMap) return [];
    return Array.from(userMap.entries()).map(([userId, role]) => ({ userId, role }));
  }

  /**
   * Get the role of a user for a specific pipeline.
   */
  getUserRole(pipelineId: string, userId: string): PipelineRole | null {
    const userMap = this.rules.get(pipelineId);
    return userMap?.get(userId) || null;
  }

  /**
   * Check if a user has a specific permission for a pipeline.
   * If no rules exist for the pipeline, default to allow (backward compatible).
   */
  hasPermission(pipelineId: string, userId: string, permission: string): PermissionResult {
    const userMap = this.rules.get(pipelineId);

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
  canTrigger(pipelineId: string, userId: string): PermissionResult {
    return this.hasPermission(pipelineId, userId, 'trigger');
  }

  /**
   * Check if user can view a pipeline.
   */
  canView(pipelineId: string, userId: string): PermissionResult {
    return this.hasPermission(pipelineId, userId, 'view');
  }

  /**
   * Check if user can cancel a pipeline run.
   * @param runId - The run ID (or pipelineId if available)
   * @param userId - The user ID
   * @param tenantId - Optional tenant ID for scoping
   * @param pipelineId - Optional pipeline ID for rule lookup (preferred over runId)
   */
  canCancel(runId: string, userId: string, _tenantId?: string, pipelineId?: string): PermissionResult {
    // Use pipelineId if provided, otherwise fall back to runId for rule lookup
    const key = pipelineId || runId;
    return this.hasPermission(key, userId, 'cancel');
  }

  /**
   * Check if user can approve a pipeline run.
   * @param runId - The run ID (or pipelineId if available)
   * @param userId - The user ID
   * @param tenantId - Optional tenant ID for scoping
   * @param pipelineId - Optional pipeline ID for rule lookup (preferred over runId)
   */
  canApprove(runId: string, userId: string, _tenantId?: string, pipelineId?: string): PermissionResult {
    const key = pipelineId || runId;
    return this.hasPermission(key, userId, 'approve');
  }
}
