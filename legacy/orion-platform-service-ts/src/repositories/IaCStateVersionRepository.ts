/**
 * IaC State Version Repository - Data access layer for iac_state_versions table
 */

import { BaseRepository } from '../db/base-repository';
import { IaCStateVersion } from '../models/IacWorkspace';

export interface IaCStateVersionEntity {
  id: string;
  workspaceId: string;
  version: number;
  timestamp: Date;
  commitSha: string;
  author: string;
  size: number;
  createdAt?: string;
  serialNumber?: number;
  lineage?: string;
}

export class IaCStateVersionRepository extends BaseRepository<IaCStateVersionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'iac_state_versions');
  }

  /**
   * Get all state versions for a workspace, ordered by version descending
   */
  async findByWorkspace(workspaceId: string): Promise<IaCStateVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM iac_state_versions WHERE workspace_id = $1 ORDER BY version DESC`,
      [workspaceId],
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * Get the current (latest) state version for a workspace
   */
  async findCurrent(workspaceId: string): Promise<IaCStateVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM iac_state_versions WHERE workspace_id = $1 ORDER BY version DESC LIMIT 1`,
      [workspaceId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Get the next version number for a workspace
   */
  async getNextVersion(workspaceId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM iac_state_versions WHERE workspace_id = $1`,
      [workspaceId],
    );
    return result.rows[0]?.next_version ?? 1;
  }

  protected mapRowToEntity(row: any): IaCStateVersionEntity {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      version: row.version,
      timestamp: row.timestamp,
      commitSha: row.commit_sha,
      author: row.author,
      size: row.size,
    };
  }
}
