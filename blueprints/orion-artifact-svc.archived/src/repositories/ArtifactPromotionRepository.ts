/**
 * ArtifactPromotionRepository — PostgreSQL data access for artifact promotions.
 * Fixed: aligned column names with migration schema (from_stage/to_stage/promoted_at)
 */

export interface ArtifactPromotionEntity {
  id: string;
  artifact_id: string;
  from_stage: string | null;
  to_stage: string;
  promoted_by: string;
  approved_by: string | null;
  reason: string | null;
  promoted_at: Date;
}

export class ArtifactPromotionRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async create(data: {
    artifactId: string; fromStage: string | null; toStage: string;
    promotedBy: string; approvedBy?: string | null; reason?: string | null;
  }): Promise<ArtifactPromotionEntity> {
    const id = `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result = await this.db.query(
      `INSERT INTO artifact_promotions (id, artifact_id, from_stage, to_stage, promoted_by, approved_by, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, data.artifactId, data.fromStage, data.toStage, data.promotedBy, data.approvedBy || null, data.reason || null]
    );
    return result.rows[0];
  }

  async approve(promotionId: string, approvedBy: string): Promise<void> {
    await this.db.query(
      'UPDATE artifact_promotions SET approved_by = $1 WHERE id = $2',
      [approvedBy, promotionId]
    );
  }

  async findByArtifact(artifactId: string): Promise<ArtifactPromotionEntity[]> {
    const result = await this.db.query(
      'SELECT * FROM artifact_promotions WHERE artifact_id = $1 ORDER BY promoted_at DESC',
      [artifactId]
    );
    return result.rows;
  }
}
