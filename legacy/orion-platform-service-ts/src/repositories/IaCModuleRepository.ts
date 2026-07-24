/**
 * IaC Module Repository - Data access layer for iac_modules table
 */

import { BaseRepository } from '../db/base-repository';
import { IaCModule } from '../models/IacWorkspace';

export interface IaCModuleEntity {
  id: string;
  name: string;
  version: string;
  source: string;
  dependencies: Record<string, unknown>;
  createdAt: Date;
}

export class IaCModuleRepository extends BaseRepository<IaCModuleEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'iac_modules');
  }

  /**
   * Find module by name
   */
  async findByName(name: string): Promise<IaCModuleEntity[] | undefined> {
    const result = await this.db.query(
      `SELECT * FROM iac_modules WHERE name = $1 ORDER BY version DESC`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * List all modules
   */
  async findAllModules(): Promise<IaCModuleEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM iac_modules ORDER BY name ASC, version DESC`,
    );
    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): IaCModuleEntity {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      source: row.source,
      dependencies: typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : (row.dependencies ?? {}),
      createdAt: row.created_at,
    };
  }
}
