import { BaseRepository } from '../db/base-repository';

export interface ArtifactPromotionEntity {
  id: string;
  artifactId: string;
  fromEnv: string;
  toEnv: string;
  status: string;
  promotedBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  reason: string | null;
  createdAt: Date;
}

export class ArtifactPromotionRepository extends BaseRepository<ArtifactPromotionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'artifact_promotions');
  }

  async findByArtifact(artifactId: string): Promise<ArtifactPromotionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_promotions WHERE artifact_id = $1 ORDER BY created_at DESC`,
      [artifactId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByStatus(status: string): Promise<ArtifactPromotionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_promotions WHERE status = $1 ORDER BY created_at DESC`,
      [status],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByEnvironment(env: string): Promise<ArtifactPromotionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM artifact_promotions WHERE from_env = $1 OR to_env = $1 ORDER BY created_at DESC`,
      [env],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: string): Promise<ArtifactPromotionEntity | null> {
    const result = await this.db.query(
      `UPDATE artifact_promotions SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  async approve(id: string, approvedBy: string): Promise<ArtifactPromotionEntity | null> {
    const result = await this.db.query(
      `UPDATE artifact_promotions SET approved_by = $1, approved_at = NOW(), status = 'approved' WHERE id = $2 RETURNING *`,
      [approvedBy, id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToEntity(result.rows[0]);
  }

  protected mapRowToEntity(row: any): ArtifactPromotionEntity {
    return {
      id: row.id,
      artifactId: row.artifact_id,
      fromEnv: row.from_env,
      toEnv: row.to_env,
      status: row.status ?? 'pending',
      promotedBy: row.promoted_by ?? '',
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      reason: row.reason,
      createdAt: row.created_at,
    };
  }
}