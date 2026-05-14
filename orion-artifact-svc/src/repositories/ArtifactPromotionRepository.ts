/**
 * ArtifactPromotionRepository — PostgreSQL data access for artifact promotions.
 */

export interface ArtifactPromotionEntity {
  id: string;
  artifact_id: string;
  from_env: string;
  to_env: string;
  status: string;
  promoted_by: string;
  approved_by: string | null;
  approved_at: Date | null;
  reason: string | null;
  created_at: Date;
}

export class ArtifactPromotionRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async create(data: {
    artifactId: string; fromEnv: string; toEnv: string; status: string;
    promotedBy: string; approvedBy: string | null; approvedAt: Date | null;
    reason: string | null; createdAt: Date;
  }): Promise<ArtifactPromotionEntity> {
    const id = `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO artifact_promotions (id, artifact_id, from_env, to_env, status, promoted_by, approved_by, approved_at, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [id, data.artifactId, data.fromEnv, data.toEnv, data.status, data.promotedBy, data.approvedBy, data.approvedAt, data.reason, data.createdAt]
    );
    return result.rows[0];
  }

  async approve(promotionId: string, approvedBy: string): Promise<void> {
    await this.db.query(
      'UPDATE artifact_promotions SET approved_by = $1, approved_at = NOW() WHERE id = $2',
      [approvedBy, promotionId]
    );
  }

  async findByArtifact(artifactId: string): Promise<ArtifactPromotionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_promotions WHERE artifact_id = $1 ORDER BY created_at DESC',
      [artifactId]
    );
    return result.rows;
  }
}
