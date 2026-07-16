/**
 * BuilderImageRepository — PostgreSQL data access for builder image registry
 *
 * Manages the builder_images table which stores preset and custom builder images.
 */

import { BaseRepository } from '../db/base-repository';
import {
  PresetImageType,
  BuilderImageStatus,
  ImagePullPolicy,
} from '../models/BuilderImage';

export interface BuilderImageEntity {
  id: string;
  name: string;
  displayName: string;
  image: string;
  type: string;
  version: string;
  description: string;
  pullPolicy: string;
  status: string;
  isPreset: boolean;
  env?: Record<string, string>;
  labels?: Record<string, string>;
  createdBy?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export class BuilderImageRepository extends BaseRepository<BuilderImageEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'builder_images');
  }

  async findByName(name: string): Promise<BuilderImageEntity | undefined> {
    const result = await this.db.query('SELECT * FROM builder_images WHERE name = $1', [name]);
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async listByType(type: string): Promise<BuilderImageEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM builder_images WHERE type = $1 ORDER BY created_at DESC',
      [type],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByStatus(status: string): Promise<BuilderImageEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM builder_images WHERE status = $1 ORDER BY created_at DESC',
      [status],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async listByIsPreset(isPreset: boolean): Promise<BuilderImageEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM builder_images WHERE is_preset = $1 ORDER BY created_at DESC',
      [isPreset],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async findActive(): Promise<BuilderImageEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM builder_images WHERE status = $1 ORDER BY created_at DESC',
      [BuilderImageStatus.ACTIVE],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async findByTypeAndActive(type: string): Promise<BuilderImageEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM builder_images WHERE type = $1 AND status = $2 ORDER BY created_at DESC',
      [type, BuilderImageStatus.ACTIVE],
    );
    return result.rows.map(r => this.mapRowToEntity(r));
  }

  async updateStatus(id: string, status: string): Promise<BuilderImageEntity | null> {
    const result = await this.db.query(
      `UPDATE builder_images SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  protected mapRowToEntity(row: any): BuilderImageEntity {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      image: row.image,
      type: row.type,
      version: row.version,
      description: row.description,
      pullPolicy: row.pull_policy,
      status: row.status,
      isPreset: row.is_preset,
      env: row.env,
      labels: row.labels,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    };
  }
}
