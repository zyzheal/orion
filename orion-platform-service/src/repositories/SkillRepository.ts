/**
 * SkillRepository
 * 技能数据访问层
 */

import { BaseRepository } from '../db/base-repository';
import { OrionError, ErrorCode } from '../../errors';

export interface SkillEntity {
  id: string;
  name: string;
  description: string;
  category: string;
  commands: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SkillRepository extends BaseRepository<SkillEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'skills');
  }

  async findByName(name: string): Promise<SkillEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM skills WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByCategory(category: string): Promise<SkillEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM skills WHERE category = $1 ORDER BY created_at DESC`,
      [category],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<SkillEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM skills WHERE enabled = true ORDER BY created_at DESC`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async setEnabled(id: string, enabled: boolean): Promise<SkillEntity> {
    const result = await this.db.query(
      `UPDATE skills SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [enabled, id],
    );
    if (result.rows.length === 0) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Skill with id ${id} not found`);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): SkillEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      commands: row.commands ?? {},
      enabled: row.enabled ?? false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}