/**
 * IaC Workspace Repository - Data access layer for iac_workspaces table
 */

import { BaseRepository } from '../db/base-repository';
import { IaCWorkspace, IaCWorkspaceStatus, IaCProvider, IaCEnvironment } from '../models/IacWorkspace';

export interface IaCWorkspaceEntity {
  id: string;
  name: string;
  projectId: string;
  environment: IaCEnvironment;
  statePath: string;
  variables: Record<string, unknown>;
  lockedBy: string | null;
  status: IaCWorkspaceStatus;
  provider: IaCProvider;
  createdAt: Date;
}

export class IaCWorkspaceRepository extends BaseRepository<IaCWorkspaceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'iac_workspaces');
  }

  /**
   * Find all workspaces with optional filters
   */
  async findAllFiltered(filters?: {
    projectId?: string;
    environment?: IaCEnvironment;
    status?: IaCWorkspaceStatus;
    provider?: IaCProvider;
  }): Promise<IaCWorkspaceEntity[]> {
    let query = `SELECT * FROM iac_workspaces WHERE 1=1`;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.projectId) {
      query += ` AND project_id = $${paramIndex}`;
      params.push(filters.projectId);
      paramIndex++;
    }
    if (filters?.environment) {
      query += ` AND environment = $${paramIndex}`;
      params.push(filters.environment);
      paramIndex++;
    }
    if (filters?.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters?.provider) {
      query += ` AND provider = $${paramIndex}`;
      params.push(filters.provider);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): IaCWorkspaceEntity {
    return {
      id: row.id,
      name: row.name,
      projectId: row.project_id,
      environment: row.environment as IaCEnvironment,
      statePath: row.state_path ?? '',
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : (row.variables ?? {}),
      lockedBy: row.locked_by ?? null,
      status: row.status as IaCWorkspaceStatus,
      provider: row.provider as IaCProvider,
      createdAt: row.created_at,
    };
  }
}
