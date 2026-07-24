/**
 * DeployGitCommitLinkRepository - Database layer for Git Commit ↔ Deployment linkage
 *
 * TASK-5.9: Deploy Git Integration
 * Persisted via PostgreSQL Repository pattern with tenant_id isolation.
 */

import { BaseRepository } from '../db/base-repository';

export interface DeployGitCommitLinkEntity {
  id: string;
  deploymentId: string;
  tenantId: string;
  commitSha: string;
  commitMessage: string | null;
  commitAuthor: string | null;
  commitEmail: string | null;
  committedAt: Date | null;
  branch: string | null;
  prNumber: string | null;
  prUrl: string | null;
  linkedAt: Date;
  createdAt: Date;
}

export class DeployGitCommitLinkRepository extends BaseRepository<DeployGitCommitLinkEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'deploy_git_commit_links');
  }

  // ==================== Queries ====================

  /**
   * Find link by deployment ID
   */
  async findByDeploymentId(deploymentId: string): Promise<DeployGitCommitLinkEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM deploy_git_commit_links WHERE deployment_id = $1 LIMIT 1`,
      [deploymentId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find link by commit SHA
   */
  async findByCommitSha(commitSha: string): Promise<DeployGitCommitLinkEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM deploy_git_commit_links WHERE commit_sha = $1 LIMIT 1`,
      [commitSha],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find all links for a tenant
   */
  async findByTenantId(tenantId: string, limit = 50): Promise<DeployGitCommitLinkEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deploy_git_commit_links WHERE tenant_id = $1 ORDER BY linked_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find links by branch
   */
  async findByBranch(tenantId: string, branch: string, limit = 50): Promise<DeployGitCommitLinkEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM deploy_git_commit_links WHERE tenant_id = $1 AND branch = $2 ORDER BY linked_at DESC LIMIT $3`,
      [tenantId, branch, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Create a new commit link
   */
  async createLink(data: {
    deploymentId: string;
    tenantId: string;
    commitSha: string;
    commitMessage?: string;
    commitAuthor?: string;
    commitEmail?: string;
    committedAt?: Date;
    branch?: string;
    prNumber?: string;
    prUrl?: string;
  }): Promise<DeployGitCommitLinkEntity> {
    const result = await this.db.query(
      `INSERT INTO deploy_git_commit_links
       (deployment_id, tenant_id, commit_sha, commit_message, commit_author, commit_email, committed_at, branch, pr_number, pr_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.deploymentId,
        data.tenantId,
        data.commitSha,
        data.commitMessage ?? null,
        data.commitAuthor ?? null,
        data.commitEmail ?? null,
        data.committedAt ?? null,
        data.branch ?? null,
        data.prNumber ?? null,
        data.prUrl ?? null,
      ],
    );
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Upsert by deployment ID (update if exists, insert if not)
   */
  async upsertByDeploymentId(data: {
    deploymentId: string;
    tenantId: string;
    commitSha: string;
    commitMessage?: string;
    commitAuthor?: string;
    commitEmail?: string;
    committedAt?: Date;
    branch?: string;
    prNumber?: string;
    prUrl?: string;
  }): Promise<DeployGitCommitLinkEntity> {
    const existing = await this.findByDeploymentId(data.deploymentId);
    if (existing) {
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.commitSha !== undefined) { setClauses.push(`commit_sha = $${paramIndex++}`); params.push(data.commitSha); }
      if (data.commitMessage !== undefined) { setClauses.push(`commit_message = $${paramIndex++}`); params.push(data.commitMessage); }
      if (data.commitAuthor !== undefined) { setClauses.push(`commit_author = $${paramIndex++}`); params.push(data.commitAuthor); }
      if (data.commitEmail !== undefined) { setClauses.push(`commit_email = $${paramIndex++}`); params.push(data.commitEmail); }
      if (data.committedAt !== undefined) { setClauses.push(`committed_at = $${paramIndex++}`); params.push(data.committedAt); }
      if (data.branch !== undefined) { setClauses.push(`branch = $${paramIndex++}`); params.push(data.branch); }
      if (data.prNumber !== undefined) { setClauses.push(`pr_number = $${paramIndex++}`); params.push(data.prNumber); }
      if (data.prUrl !== undefined) { setClauses.push(`pr_url = $${paramIndex++}`); params.push(data.prUrl); }

      params.push(data.deploymentId);
      const result = await this.db.query(
        `UPDATE deploy_git_commit_links SET ${setClauses.join(', ')} WHERE deployment_id = $${paramIndex} RETURNING *`,
        params,
      );
      return this.mapRowToEntity(result.rows[0]);
    }

    return this.createLink(data);
  }

  /**
   * Delete link by deployment ID
   */
  async deleteByDeploymentId(deploymentId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM deploy_git_commit_links WHERE deployment_id = $1`,
      [deploymentId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Mapping ====================

  protected mapRowToEntity(row: any): DeployGitCommitLinkEntity {
    return {
      id: row.id,
      deploymentId: row.deployment_id,
      tenantId: row.tenant_id,
      commitSha: row.commit_sha,
      commitMessage: row.commit_message ?? null,
      commitAuthor: row.commit_author ?? null,
      commitEmail: row.commit_email ?? null,
      committedAt: row.committed_at ?? null,
      branch: row.branch ?? null,
      prNumber: row.pr_number ?? null,
      prUrl: row.pr_url ?? null,
      linkedAt: row.linked_at ?? row.created_at,
      createdAt: row.created_at,
    };
  }
}
