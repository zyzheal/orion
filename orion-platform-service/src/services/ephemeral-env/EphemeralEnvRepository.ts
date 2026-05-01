/**
 * EphemeralEnvRepository - Database layer for Ephemeral Environments
 *
 * Replaces the in-memory Map storage with PostgreSQL persistence.
 */
import { DatabasePool } from '../database';
import {
  EphemeralEnvironment,
  EphemeralEnvStatus,
  EphemeralEnvCreateInput,
  EphemeralResourceConfig,
  EphemeralService,
} from '../../models/EphemeralEnvironment';

export interface EphemeralEnvRecord {
  id: string;
  pr_id: string;
  repo_id: string;
  branch_name: string;
  namespace: string;
  status: string;
  preview_url: string | null;
  commit_sha: string | null;
  resources: EphemeralResourceConfig;
  services: EphemeralService[];
  created_by: string | null;
  created_at: Date;
  idle_since: Date | null;
  auto_destroy_at: Date | null;
  destroyed_at: Date | null;
  destroy_reason: string | null;
}

function toDomain(record: EphemeralEnvRecord): EphemeralEnvironment {
  return {
    id: record.id,
    prId: record.pr_id,
    repoId: record.repo_id,
    branchName: record.branch_name,
    namespace: record.namespace,
    status: record.status as EphemeralEnvStatus,
    previewUrl: record.preview_url || undefined,
    commitSha: record.commit_sha || undefined,
    resources: record.resources,
    services: record.services || [],
    createdBy: record.created_by || undefined,
    createdAt: record.created_at,
    idleSince: record.idle_since || undefined,
    autoDestroyAt: record.auto_destroy_at || undefined,
    destroyedAt: record.destroyed_at || undefined,
    destroyReason: record.destroy_reason || undefined,
  };
}

function toRecord(env: EphemeralEnvironment): EphemeralEnvRecord {
  return {
    id: env.id,
    pr_id: env.prId,
    repo_id: env.repoId,
    branch_name: env.branchName,
    namespace: env.namespace,
    status: env.status,
    preview_url: env.previewUrl || null,
    commit_sha: env.commitSha || null,
    resources: env.resources,
    services: env.services,
    created_by: env.createdBy || null,
    created_at: env.createdAt,
    idle_since: env.idleSince || null,
    auto_destroy_at: env.autoDestroyAt || null,
    destroyed_at: env.destroyedAt || null,
    destroy_reason: env.destroyReason || null,
  };
}

export class EphemeralEnvRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  /**
   * Find environment by ID
   */
  async findById(id: string): Promise<EphemeralEnvironment | null> {
    const result = await this.pool.query(
      'SELECT * FROM ephemeral_environments WHERE id = $1',
      [id]
    );
    return result.rows[0] ? toDomain(result.rows[0]) : null;
  }

  /**
   * Find all environments with optional filters
   */
  async findAll(options?: {
    prId?: string;
    repoId?: string;
    statusFilter?: EphemeralEnvStatus;
  }): Promise<EphemeralEnvironment[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options?.prId) {
      conditions.push(`pr_id = $${paramIdx++}`);
      params.push(options.prId);
    }
    if (options?.repoId) {
      conditions.push(`repo_id = $${paramIdx++}`);
      params.push(options.repoId);
    }
    if (options?.statusFilter) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(options.statusFilter);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `SELECT * FROM ephemeral_environments ${where} ORDER BY created_at DESC`,
      params
    );
    return result.rows.map(toDomain);
  }

  /**
   * Check if an environment already exists for a given PR and repo
   */
  async findByPrAndRepo(
    prId: string,
    repoId: string,
    excludeStatuses: EphemeralEnvStatus[] = ['destroyed']
  ): Promise<EphemeralEnvironment | null> {
    const params: unknown[] = [prId, repoId];
    let paramIdx = 3;
    let excludeClause = '';

    if (excludeStatuses.length > 0) {
      const placeholders = excludeStatuses.map(() => `$${paramIdx++}`).join(', ');
      excludeClause = ` AND status NOT IN (${placeholders})`;
      params.push(...excludeStatuses);
    }

    const result = await this.pool.query(
      `SELECT * FROM ephemeral_environments WHERE pr_id = $1 AND repo_id = $2${excludeClause} LIMIT 1`,
      params
    );
    return result.rows[0] ? toDomain(result.rows[0]) : null;
  }

  /**
   * Create a new environment record
   */
  async create(input: EphemeralEnvCreateInput, env: EphemeralEnvironment): Promise<EphemeralEnvironment> {
    const record = toRecord(env);
    const result = await this.pool.query(
      `INSERT INTO ephemeral_environments (
        id, pr_id, repo_id, branch_name, namespace, status,
        preview_url, commit_sha, resources, services, created_by,
        created_at, auto_destroy_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        record.id,
        record.pr_id,
        record.repo_id,
        record.branch_name,
        record.namespace,
        record.status,
        record.preview_url,
        record.commit_sha,
        JSON.stringify(record.resources),
        JSON.stringify(record.services),
        record.created_by,
        record.created_at,
        record.auto_destroy_at,
      ]
    );
    return toDomain(result.rows[0]);
  }

  /**
   * Update environment fields
   */
  async update(
    id: string,
    fields: Partial<{
      status: EphemeralEnvStatus;
      previewUrl: string;
      services: EphemeralService[];
      idleSince: Date;
      autoDestroyAt: Date;
      destroyedAt: Date;
      destroyReason: string;
    }>
  ): Promise<EphemeralEnvironment | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (fields.status !== undefined) {
      updates.push(`status = $${idx++}`);
      params.push(fields.status);
    }
    if (fields.previewUrl !== undefined) {
      updates.push(`preview_url = $${idx++}`);
      params.push(fields.previewUrl);
    }
    if (fields.services !== undefined) {
      updates.push(`services = $${idx++}`);
      params.push(JSON.stringify(fields.services));
    }
    if (fields.idleSince !== undefined) {
      updates.push(`idle_since = $${idx++}`);
      params.push(fields.idleSince);
    }
    if (fields.autoDestroyAt !== undefined) {
      updates.push(`auto_destroy_at = $${idx++}`);
      params.push(fields.autoDestroyAt);
    }
    if (fields.destroyedAt !== undefined) {
      updates.push(`destroyed_at = $${idx++}`);
      params.push(fields.destroyedAt);
    }
    if (fields.destroyReason !== undefined) {
      updates.push(`destroy_reason = $${idx++}`);
      params.push(fields.destroyReason);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE ephemeral_environments SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0] ? toDomain(result.rows[0]) : null;
  }

  /**
   * Delete environment by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM ephemeral_environments WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find idle environments older than a cutoff time
   */
  async findIdleBefore(cutoff: Date): Promise<EphemeralEnvironment[]> {
    const result = await this.pool.query(
      `SELECT * FROM ephemeral_environments WHERE status = 'idle' AND idle_since < $1 ORDER BY idle_since ASC`,
      [cutoff]
    );
    return result.rows.map(toDomain);
  }
}
