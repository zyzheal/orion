import { BaseRepository } from '../db/base-repository';

export interface IaCPlanEntity {
  id: string;
  name: string;
  workspaceId: string;
  terraformVersion: string | null;
  planContent: Record<string, any>;
  resourcesToAdd: number;
  resourcesToChange: number;
  resourcesToDestroy: number;
  applied: boolean;
  appliedAt: Date | null;
  appliedBy: string | null;
  createdAt: Date;
}

export class IaCPlanRepository extends BaseRepository<IaCPlanEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'iac_plans');
  }

  async findUnapplied(): Promise<IaCPlanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM iac_plans WHERE applied = false ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findApplied(): Promise<IaCPlanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM iac_plans WHERE applied = true ORDER BY applied_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async markApplied(id: string, appliedBy: string): Promise<void> {
    await this.db.query(
      `UPDATE iac_plans SET applied = true, applied_at = NOW(), applied_by = $1 WHERE id = $2`,
      [appliedBy, id],
    );
  }

  async findByName(name: string): Promise<IaCPlanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM iac_plans WHERE name = $1 ORDER BY created_at DESC`,
      [name],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findRecent(limit: number = 100): Promise<IaCPlanEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM iac_plans ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): IaCPlanEntity {
    return {
      id: row.id,
      name: row.name,
      workspaceId: row.workspace_id,
      terraformVersion: row.terraform_version,
      planContent: row.plan_content ?? {},
      resourcesToAdd: row.resources_to_add ?? 0,
      resourcesToChange: row.resources_to_change ?? 0,
      resourcesToDestroy: row.resources_to_destroy ?? 0,
      applied: row.applied ?? false,
      appliedAt: row.applied_at,
      appliedBy: row.applied_by,
      createdAt: row.created_at,
    };
  }
}