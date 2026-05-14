/**
 * KnownIssueService - Known Issue Management
 *
 * Provides operations for managing known issues including:
 * - Create, read, update, delete known issues
 * - Track issue resolution status
 * - Link issues to tickets
 * - Search by fingerprint
 */

import pino from 'pino';
import { randomUUID } from 'crypto';
import { DatabasePool } from '../database';
import { KnownIssueRepository, KnownIssueEntity } from '../../repositories/KnownIssueRepository';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Types ====================

export interface CreateIssueInput {
  tenantId: string;
  title: string;
  description?: string;
  fingerprint: string;
  ticketId?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  fingerprint?: string;
  ticketId?: string;
  resolved?: boolean;
}

export interface KnownIssue {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  fingerprint: string;
  ticketId: string | null;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
}

// ==================== KnownIssueService ====================

export class KnownIssueService {
  private repository: KnownIssueRepository | null = null;

  // In-memory fallback
  private issues = new Map<string, KnownIssueEntity>();

  constructor(db?: DatabasePool) {
    if (db) {
      this.repository = new KnownIssueRepository(db);
    }
  }

  /**
   * Set repository after construction (for lazy initialization)
   */
  setRepository(repository: KnownIssueRepository): void {
    this.repository = repository;
  }

  // ==================== CRUD Operations ====================

  /**
   * Create a new known issue
   */
  async createIssue(input: CreateIssueInput): Promise<KnownIssue> {
    const issueId = randomUUID();
    const now = new Date();

    if (this.repository) {
      const result = await this.db.query(
        `INSERT INTO known_issues
          (id, tenant_id, title, description, fingerprint, ticket_id, resolved, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)
         RETURNING *`,
        [issueId, input.tenantId, input.title, input.description ?? null, input.fingerprint, input.ticketId ?? null, now]
      );

      logger.info({ issueId, fingerprint: input.fingerprint }, '[KnownIssueService] Created known issue');
      return this.mapRowToEntity(result.rows[0]);
    }

    // Memory fallback
    const issue: KnownIssueEntity = {
      id: issueId,
      tenantId: input.tenantId,
      title: input.title,
      description: input.description ?? null,
      fingerprint: input.fingerprint,
      ticketId: input.ticketId ?? null,
      resolved: false,
      resolvedAt: null,
      createdAt: now,
    };

    this.issues.set(issueId, issue);
    logger.info({ issueId, fingerprint: input.fingerprint }, '[KnownIssueService] Created known issue (memory)');
    return this.mapEntityToKnownIssue(issue);
  }

  /**
   * Get a known issue by ID
   */
  async getIssue(id: string): Promise<KnownIssue | null> {
    if (this.repository) {
      const result = await this.repository.findById(id);
      if (!result) return null;
      return this.mapEntityToKnownIssue(result);
    }

    const issue = this.issues.get(id);
    return issue ? this.mapEntityToKnownIssue(issue) : null;
  }

  /**
   * List known issues with filtering
   */
  async listIssues(options?: {
    tenantId?: string;
    resolved?: boolean;
    fingerprint?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ issues: KnownIssue[]; total: number }> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    if (this.repository) {
      let entities: KnownIssueEntity[];

      if (options?.fingerprint) {
        entities = await this.repository.findByFingerprint(options.fingerprint);
      } else if (options?.tenantId && options.resolved !== undefined) {
        // Need to filter manually
        const all = await this.repository.findByTenantId(options.tenantId);
        entities = all.filter((e) => e.resolved === options.resolved);
      } else if (options?.tenantId) {
        entities = await this.repository.findByTenantId(options.tenantId);
      } else {
        const all = await this.repository.findOpen();
        entities = options?.resolved === false ? all : [];
      }

      const total = entities.length;
      return {
        issues: entities.slice(offset, offset + limit).map((e) => this.mapEntityToKnownIssue(e)),
        total,
      };
    }

    // Memory fallback
    let filtered = Array.from(this.issues.values());

    if (options?.tenantId) {
      filtered = filtered.filter((i) => i.tenantId === options.tenantId);
    }
    if (options?.resolved !== undefined) {
      filtered = filtered.filter((i) => i.resolved === options.resolved);
    }
    if (options?.fingerprint) {
      filtered = filtered.filter((i) => i.fingerprint === options.fingerprint);
    }

    const total = filtered.length;
    return {
      issues: filtered.slice(offset, offset + limit).map((e) => this.mapEntityToKnownIssue(e)),
      total,
    };
  }

  /**
   * Update a known issue
   */
  async updateIssue(id: string, updates: UpdateIssueInput): Promise<KnownIssue | null> {
    const existing = await this.getIssue(id);
    if (!existing) {
      return null;
    }

    if (this.repository) {
      const fields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        fields.push(`title = $${paramIndex}`);
        params.push(updates.title);
        paramIndex++;
      }
      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex}`);
        params.push(updates.description);
        paramIndex++;
      }
      if (updates.fingerprint !== undefined) {
        fields.push(`fingerprint = $${paramIndex}`);
        params.push(updates.fingerprint);
        paramIndex++;
      }
      if (updates.ticketId !== undefined) {
        fields.push(`ticket_id = $${paramIndex}`);
        params.push(updates.ticketId);
        paramIndex++;
      }
      if (updates.resolved !== undefined) {
        fields.push(`resolved = $${paramIndex}`);
        params.push(updates.resolved);
        paramIndex++;
        if (updates.resolved) {
          fields.push(`resolved_at = $${paramIndex}`);
          params.push(new Date());
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        return existing;
      }

      params.push(id);
      const result = await this.db.query(
        `UPDATE known_issues SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        params
      );

      if (result.rows.length === 0) return null;

      logger.info({ issueId: id, updates }, '[KnownIssueService] Updated known issue');
      return this.mapRowToEntity(result.rows[0]);
    }

    // Memory fallback
    const current = this.issues.get(id)!;
    const updated: KnownIssueEntity = {
      ...current,
      title: updates.title ?? current.title,
      description: updates.description ?? current.description,
      fingerprint: updates.fingerprint ?? current.fingerprint,
      ticketId: updates.ticketId ?? current.ticketId,
      resolved: updates.resolved ?? current.resolved,
      resolvedAt: updates.resolved ? new Date() : current.resolvedAt,
    };

    this.issues.set(id, updated);
    logger.info({ issueId: id, updates }, '[KnownIssueService] Updated known issue (memory)');
    return this.mapEntityToKnownIssue(updated);
  }

  /**
   * Delete a known issue
   */
  async deleteIssue(id: string): Promise<boolean> {
    if (this.repository) {
      const result = await this.db.query('DELETE FROM known_issues WHERE id = $1', [id]);
      logger.info({ issueId: id, deleted: result.rowCount > 0 }, '[KnownIssueService] Deleted known issue');
      return (result.rowCount ?? 0) > 0;
    }

    const deleted = this.issues.delete(id);
    logger.info({ issueId: id, deleted }, '[KnownIssueService] Deleted known issue (memory)');
    return deleted;
  }

  // ==================== Resolution Operations ====================

  /**
   * Resolve a known issue
   */
  async resolveIssue(id: string, resolvedAt?: Date): Promise<KnownIssue | null> {
    const time = resolvedAt ?? new Date();

    if (this.repository) {
      const result = await this.repository.resolve(id, time);
      if (!result) return null;
      logger.info({ issueId: id, resolvedAt: time }, '[KnownIssueService] Resolved known issue');
      return this.mapEntityToKnownIssue(result);
    }

    // Memory fallback
    const issue = this.issues.get(id);
    if (!issue) return null;

    const updated: KnownIssueEntity = {
      ...issue,
      resolved: true,
      resolvedAt: time,
    };

    this.issues.set(id, updated);
    logger.info({ issueId: id, resolvedAt: time }, '[KnownIssueService] Resolved known issue (memory)');
    return this.mapEntityToKnownIssue(updated);
  }

  /**
   * Link a ticket to an issue
   */
  async linkTicket(issueId: string, ticketId: string): Promise<KnownIssue | null> {
    return this.updateIssue(issueId, { ticketId });
  }

  // ==================== Search Operations ====================

  /**
   * Find issues by fingerprint (for deduplication)
   */
  async findByFingerprint(fingerprint: string): Promise<KnownIssue[]> {
    if (this.repository) {
      const entities = await this.repository.findByFingerprint(fingerprint);
      return entities.map((e) => this.mapEntityToKnownIssue(e));
    }

    const issues = Array.from(this.issues.values()).filter((i) => i.fingerprint === fingerprint);
    return issues.map((e) => this.mapEntityToKnownIssue(e));
  }

  /**
   * Get open issues for a tenant
   */
  async getOpenIssues(tenantId?: string): Promise<KnownIssue[]> {
    if (this.repository) {
      const entities = await this.repository.findOpen(tenantId);
      return entities.map((e) => this.mapEntityToKnownIssue(e));
    }

    let issues = Array.from(this.issues.values()).filter((i) => !i.resolved);
    if (tenantId) {
      issues = issues.filter((i) => i.tenantId === tenantId);
    }
    return issues.map((e) => this.mapEntityToKnownIssue(e));
  }

  // ==================== Statistics ====================

  /**
   * Get issue statistics
   */
  async getStats(tenantId?: string): Promise<{
    total: number;
    open: number;
    resolved: number;
    withTicket: number;
    withoutTicket: number;
  }> {
    const issues = await this.listIssues({ tenantId, limit: 1000 });

    return {
      total: issues.total,
      open: issues.issues.filter((i) => !i.resolved).length,
      resolved: issues.issues.filter((i) => i.resolved).length,
      withTicket: issues.issues.filter((i) => i.ticketId).length,
      withoutTicket: issues.issues.filter((i) => !i.ticketId).length,
    };
  }

  // ==================== Private Helpers ====================

  private get db() {
    return (this.repository as any)?.db;
  }

  private mapRowToEntity(row: any): KnownIssue {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      description: row.description,
      fingerprint: row.fingerprint,
      ticketId: row.ticket_id,
      resolved: row.resolved ?? false,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
    };
  }

  private mapEntityToKnownIssue(entity: KnownIssueEntity): KnownIssue {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      title: entity.title,
      description: entity.description,
      fingerprint: entity.fingerprint,
      ticketId: entity.ticketId,
      resolved: entity.resolved,
      resolvedAt: entity.resolvedAt,
      createdAt: entity.createdAt,
    };
  }
}

export default KnownIssueService;