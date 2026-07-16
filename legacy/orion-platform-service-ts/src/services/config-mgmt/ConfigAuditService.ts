/**
 * ConfigAuditService - Configuration audit trail with PostgreSQL persistence
 *
 * Records all configuration operations for compliance and traceability.
 * Supports querying, filtering, and exporting audit logs.
 *
 * Migration: in-memory Map/Array -> PostgreSQL (migration 377)
 * Fallback: DB failure automatically falls back to in-memory storage.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { ConfigAuditRepository } from './ConfigAuditRepository';
import type { AuditAction, ConfigAuditEntry, AuditFilter } from './ConfigAuditTypes';

// Re-export types to preserve public API
export type { AuditAction, ConfigAuditEntry, AuditFilter };

// ============================================================
// Service (public interface)
// ============================================================

export class ConfigAuditService {
  private repository: ConfigAuditRepository;

  constructor(database?: DatabasePool) {
    this.repository = new ConfigAuditRepository(database);
  }

  async record(
    tenantId: string,
    action: AuditAction,
    resourceType: ConfigAuditEntry['resourceType'],
    resourceId: string,
    actor: string,
    options?: {
      resourceKey?: string;
      actorRole?: string;
      oldValue?: Record<string, unknown>;
      newValue?: Record<string, unknown>;
      reason?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ConfigAuditEntry> {
    const entry: ConfigAuditEntry = {
      id: uuidv4(),
      tenantId,
      action,
      resourceType,
      resourceId,
      resourceKey: options?.resourceKey,
      actor,
      actorRole: options?.actorRole,
      oldValue: options?.oldValue,
      newValue: options?.newValue,
      reason: options?.reason,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
      metadata: options?.metadata,
      createdAt: new Date(),
    };

    await this.repository.save(entry);
    return entry;
  }

  async queryAuditLog(filter: AuditFilter): Promise<ConfigAuditEntry[]> {
    return this.repository.query(filter);
  }

  async getEntryCount(tenantId: string, resourceType?: string): Promise<number> {
    return this.repository.count({ tenantId, resourceType });
  }
}
