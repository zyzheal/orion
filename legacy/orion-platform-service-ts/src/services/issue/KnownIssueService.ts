/**
 * KnownIssueService - Known Issue Management
 *
 * Provides operations for managing known issues including:
 * - Create, read, update, delete known issues
 * - Track issue resolution status
 * - Link issues to tickets
 * - Search by fingerprint
 *
 * Migration: Map-based in-memory storage → PostgreSQL via KnownIssueRepository
 * Dual-path: repository is primary, Map is fallback when DB unavailable.
 */

import { createLogger } from '../../utils/logger';
import { randomUUID } from 'crypto';
import { DatabasePool } from '../database';
import { KnownIssueRepository, KnownIssueEntity } from '../../repositories/KnownIssueRepository';

const logger = createLogger('KnownIssueService');

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

  // In-memory fallback (synced with repository when available)
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
      const entity = await this.repository.create({
        id: issueId as string,
        tenantId: input.tenantId,
        title: input.title,
        description: input.description ?? null,
        fingerprint: input.fingerprint,
        ticketId: input.ticketId ?? null,
        resolved: false,
      } as any);

      logger.info({ issueId, fingerprint: input.fingerprint }, '[KnownIssueService] Created known issue');
      return this.mapEntityToKnownIssue(entity);
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
      const entity = await this.repository.findById(id);
      if (!entity) return null;
      return this.mapEntityToKnownIssue(entity);
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

    // Determine what changed
    const changes: Partial<Pick<KnownIssueEntity, 'title' | 'description' | 'fingerprint' | 'ticketId'>> = {};
    if (updates.title !== undefined) changes.title = updates.title;
    if (updates.description !== undefined) changes.description = updates.description;
    if (updates.fingerprint !== undefined) changes.fingerprint = updates.fingerprint;
    if (updates.ticketId !== undefined) changes.ticketId = updates.ticketId;

    if (this.repository) {
      let entity: KnownIssueEntity | null = null;

      if (Object.keys(changes).length > 0) {
        entity = await this.repository.update(id, changes);
        if (!entity) return null;
      }

      if (updates.resolved !== undefined && updates.resolved) {
        entity = await this.repository.resolve(id, new Date());
        if (!entity) return null;
      }

      if (!entity) return null;

      logger.info({ issueId: id, updates }, '[KnownIssueService] Updated known issue');
      return this.mapEntityToKnownIssue(entity);
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
      const deleted = await this.repository.delete(id);
      logger.info({ issueId: id, deleted }, '[KnownIssueService] Deleted known issue');
      return deleted;
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
      const entity = await this.repository.resolve(id, time);
      if (!entity) return null;
      logger.info({ issueId: id, resolvedAt: time }, '[KnownIssueService] Resolved known issue');
      return this.mapEntityToKnownIssue(entity);
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
