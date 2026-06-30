/**
 * PullRequestRepository — PostgreSQL data access for PR/MR event audit logs
 *
 * Persists PR check runs and comments for GitHub/GitLab integrations.
 * Uses BaseRepository with in-memory Map fallback for graceful degradation.
 */

import { BaseRepository } from '../db/base-repository';
import { v4 as uuidv4 } from 'uuid';

// ---- Row interfaces (raw DB columns, snake_case) ----

export interface PrCheckRunRow {
  id: string;
  tenant_id: string;
  provider: string;
  repository: string;
  pr_number: number;
  check_context: string;
  check_state: string;
  description: string | null;
  target_url: string | null;
  commit_sha: string | null;
  created_at: Date | string;
}

export interface PrCommentRow {
  id: string;
  tenant_id: string;
  provider: string;
  repository: string;
  pr_number: number;
  comment_body: string;
  comment_type: string;
  commit_sha: string | null;
  created_at: Date | string;
}

// ---- Entity interfaces (camelCase, used by application code) ----

export interface PrCheckStatusEntity {
  id: string;
  tenantId: string;
  provider: string;
  repository: string;
  prNumber: number;
  checkContext: string;
  checkState: 'pending' | 'success' | 'failure' | 'error';
  description?: string;
  targetUrl?: string;
  commitSha?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PrCommentEntity {
  id: string;
  tenantId: string;
  provider: string;
  repository: string;
  prNumber: number;
  commentBody: string;
  commentType: string;
  commitSha?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ---- BaseRepository subclasses ----

class PrCheckRunRepository extends BaseRepository<PrCheckStatusEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    super(db, 'pr_check_runs');
  }

  protected mapRowToEntity(row: PrCheckRunRow): PrCheckStatusEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      repository: row.repository,
      prNumber: row.pr_number,
      checkContext: row.check_context,
      checkState: row.check_state as 'pending' | 'success' | 'failure' | 'error',
      description: row.description || undefined,
      targetUrl: row.target_url || undefined,
      commitSha: row.commit_sha || undefined,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : new Date(row.created_at.getTime()),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}

class PrCommentRepository extends BaseRepository<PrCommentEntity> {
  constructor(
    db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    super(db, 'pr_comments');
  }

  protected mapRowToEntity(row: PrCommentRow): PrCommentEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      repository: row.repository,
      prNumber: row.pr_number,
      commentBody: row.comment_body,
      commentType: row.comment_type,
      commitSha: row.commit_sha || undefined,
      createdAt: typeof row.created_at === 'string' ? new Date(row.created_at) : new Date(row.created_at.getTime()),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}

// ---- Query option types ----

export interface CheckHistoryFilter {
  repository?: string;
  prNumber?: number;
  provider?: string;
  checkState?: string;
}

export interface CommentFilter {
  repository?: string;
  prNumber?: number;
  provider?: string;
}

export type DbPool = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

// ---- Main Repository with Map fallback ----

/**
 * PullRequestRepository — aggregates both check runs and comments persistence.
 *
 * On construction with a DB pool, all writes go to PostgreSQL.
 * On construction without a pool (pool = undefined), all writes go to in-memory Maps.
 * In both cases, the Map caches the last write for immediate readback.
 */
export class PullRequestRepository {
  private checkRepo: PrCheckRunRepository | null;
  private commentRepo: PrCommentRepository | null;

  // In-memory fallback stores (mirrors DB when available, sole store when not)
  private checkRuns = new Map<string, PrCheckStatusEntity>();
  private comments = new Map<string, PrCommentEntity>();

  constructor(pool?: DbPool) {
    if (pool) {
      this.checkRepo = new PrCheckRunRepository(pool);
      this.commentRepo = new PrCommentRepository(pool);
    } else {
      this.checkRepo = null;
      this.commentRepo = null;
    }
  }

  private isDbAvailable(): boolean {
    return this.checkRepo !== null;
  }

  // ---- PR Check Status Persistence ----

  /**
   * Save a PR check status record.
   * Writes to DB + syncs to Map fallback.
   */
  async saveCheckStatus(record: Omit<PrCheckStatusEntity, 'id' | 'createdAt'>): Promise<PrCheckStatusEntity> {
    const now = new Date();
    const fullRecord: PrCheckStatusEntity = {
      ...record,
      id: uuidv4(),
      createdAt: now,
    };

    if (!this.isDbAvailable()) {
      this.checkRuns.set(fullRecord.id, fullRecord);
      return fullRecord;
    }

    // Write to PostgreSQL
    const dbResult = await this.checkRepo!.create({
      id: fullRecord.id,
      tenantId: fullRecord.tenantId,
      provider: fullRecord.provider,
      repository: fullRecord.repository,
      prNumber: fullRecord.prNumber,
      checkContext: fullRecord.checkContext,
      checkState: fullRecord.checkState,
      description: fullRecord.description || null,
      targetUrl: fullRecord.targetUrl || null,
      commitSha: fullRecord.commitSha || null,
    });

    // Sync Map fallback
    this.checkRuns.set(dbResult.id, dbResult);
    return dbResult;
  }

  /**
   * Get check history with optional filters.
   * Queries DB when available, otherwise falls back to Map.
   */
  async getCheckHistory(opts: CheckHistoryFilter): Promise<PrCheckStatusEntity[]> {
    if (!this.isDbAvailable()) {
      let results = Array.from(this.checkRuns.values());
      if (opts.repository) results = results.filter(r => r.repository === opts.repository);
      if (opts.prNumber !== undefined) results = results.filter(r => r.prNumber === opts.prNumber);
      if (opts.provider) results = results.filter(r => r.provider === opts.provider);
      if (opts.checkState) results = results.filter(r => r.checkState === opts.checkState);
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Build where clause from opts
    const where: Record<string, any> = {};
    if (opts.repository) where.repository = opts.repository;
    if (opts.prNumber !== undefined) where.prNumber = opts.prNumber;
    if (opts.provider) where.provider = opts.provider;
    if (opts.checkState) where.checkState = opts.checkState;

    const result = await this.checkRepo!.findAll({ where, orderBy: 'created_at', orderDir: 'DESC', limit: 1000, offset: 0 });
    return result.entities;
  }

  /**
   * Delete check records before a date.
   */
  async deleteCheckHistory(beforeDate: Date): Promise<number> {
    if (!this.isDbAvailable()) {
      let count = 0;
      for (const [id, record] of this.checkRuns) {
        if (record.createdAt < beforeDate) {
          this.checkRuns.delete(id);
          count++;
        }
      }
      return count;
    }

    // Use raw query for DELETE with RETURNING
    const query = `DELETE FROM pr_check_runs WHERE created_at < $1 RETURNING id`;
    const result = await this.checkRepo!.getDb().query(query, [beforeDate]);
    const deleted = result.rowCount ?? 0;

    // Sync Map fallback
    for (const [id, record] of this.checkRuns) {
      if (record.createdAt < beforeDate) {
        this.checkRuns.delete(id);
      }
    }

    return deleted;
  }

  // ---- PR Comment Persistence ----

  /**
   * Save a PR comment record.
   */
  async saveComment(record: Omit<PrCommentEntity, 'id' | 'createdAt'>): Promise<PrCommentEntity> {
    const now = new Date();
    const fullRecord: PrCommentEntity = {
      ...record,
      id: uuidv4(),
      createdAt: now,
    };

    if (!this.isDbAvailable()) {
      this.comments.set(fullRecord.id, fullRecord);
      return fullRecord;
    }

    // Write to PostgreSQL
    const dbResult = await this.commentRepo!.create({
      id: fullRecord.id,
      tenantId: fullRecord.tenantId,
      provider: fullRecord.provider,
      repository: fullRecord.repository,
      prNumber: fullRecord.prNumber,
      commentBody: fullRecord.commentBody,
      commentType: fullRecord.commentType,
      commitSha: fullRecord.commitSha || null,
    });

    // Sync Map fallback
    this.comments.set(dbResult.id, dbResult);
    return dbResult;
  }

  /**
   * Get PR comments with optional filters.
   */
  async getComments(opts: CommentFilter): Promise<PrCommentEntity[]> {
    if (!this.isDbAvailable()) {
      let results = Array.from(this.comments.values());
      if (opts.repository) results = results.filter(r => r.repository === opts.repository);
      if (opts.prNumber !== undefined) results = results.filter(r => r.prNumber === opts.prNumber);
      if (opts.provider) results = results.filter(r => r.provider === opts.provider);
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const where: Record<string, any> = {};
    if (opts.repository) where.repository = opts.repository;
    if (opts.prNumber !== undefined) where.prNumber = opts.prNumber;
    if (opts.provider) where.provider = opts.provider;

    const result = await this.commentRepo!.findAll({ where, orderBy: 'created_at', orderDir: 'DESC', limit: 1000, offset: 0 });
    return result.entities;
  }
}
