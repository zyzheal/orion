/**
 * NamespaceRepository - Config namespace data access
 * 配置命名空间数据访问层
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../utils/database';

export interface NamespaceEntity {
  id: string;
  name: string;
  description?: string;
  gitRepoUrl?: string;
  branch: string;
  createdAt: Date;
}

export class NamespaceRepository {
  private db: DatabasePool;

  constructor(db: DatabasePool) {
    this.db = db;
  }

  /**
   * Create a new namespace
   */
  async create(data: {
    name: string;
    description?: string;
    gitRepoUrl?: string;
    branch?: string;
  }): Promise<NamespaceEntity> {
    const id = uuidv4();
    const result = await this.db.query(
      `INSERT INTO config_namespaces (id, name, description, git_repo_url, branch)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, data.name, data.description || null, data.gitRepoUrl || null, data.branch || 'main'],
    );
    if (result.rows.length === 0) {
      throw new Error('Failed to create namespace');
    }
    return this.mapRow(result.rows[0]);
  }

  /**
   * List all namespaces
   */
  async findAll(): Promise<NamespaceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM config_namespaces ORDER BY name ASC`,
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Find namespace by name
   */
  async findByName(name: string): Promise<NamespaceEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM config_namespaces WHERE name = $1`,
      [name],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  /**
   * Delete namespace by id
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM config_namespaces WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): NamespaceEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      gitRepoUrl: row.git_repo_url,
      branch: row.branch,
      createdAt: row.created_at,
    };
  }
}
