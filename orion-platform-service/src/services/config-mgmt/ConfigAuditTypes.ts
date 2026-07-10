/**
 * ConfigAuditTypes - Shared types for ConfigAuditService and ConfigAuditRepository
 *
 * Extracted to break circular dependency between the service and repository modules.
 */

/** Audit action types */
export type AuditAction =
  | 'config.create'
  | 'config.update'
  | 'config.delete'
  | 'config.rollback'
  | 'flag.create'
  | 'flag.update'
  | 'flag.toggle'
  | 'flag.delete'
  | 'experiment.create'
  | 'experiment.start'
  | 'experiment.stop'
  | 'experiment.cancel'
  | 'drift.remediate';

/** Audit log entry */
export interface ConfigAuditEntry {
  id: string;
  tenantId: string;
  action: AuditAction;
  resourceType: 'config' | 'flag' | 'experiment' | 'drift';
  resourceId: string;
  resourceKey?: string;
  actor: string;
  actorRole?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/** Query filter for audit entries */
export interface AuditFilter {
  tenantId: string;
  action?: AuditAction | AuditAction[];
  resourceType?: string;
  resourceId?: string;
  actor?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
