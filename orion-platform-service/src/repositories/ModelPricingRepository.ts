import { BaseRepository } from '../db/base-repository';

export interface ModelPricingEntity {
  id: string;
  modelId: string;
  inputPrice: number;
  outputPrice: number;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ModelPricingRepository extends BaseRepository<ModelPricingEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'model_custom_pricing');
  }

  async findByModelId(modelId: string): Promise<ModelPricingEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM model_custom_pricing WHERE model_id = $1 LIMIT 1`,
      [modelId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<ModelPricingEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM model_custom_pricing WHERE tenant_id = $1 ORDER BY model_id`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertByModelId(modelId: string, data: { inputPrice: number; outputPrice: number; tenantId?: string }): Promise<ModelPricingEntity | null> {
    const existing = await this.findByModelId(modelId);
    if (existing) {
      return this.update(existing.id, {
        input_price: data.inputPrice,
        output_price: data.outputPrice,
      });
    }
    return this.create({
      id: `pricing-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      model_id: modelId,
      input_price: data.inputPrice,
      output_price: data.outputPrice,
      tenant_id: data.tenantId || null,
    });
  }

  async deleteByModelId(modelId: string): Promise<boolean> {
    const result = await this.db.query(
      `DELETE FROM model_custom_pricing WHERE model_id = $1`,
      [modelId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  protected mapRowToEntity(row: any): ModelPricingEntity {
    return {
      id: row.id,
      modelId: row.model_id,
      inputPrice: Number(row.input_price ?? 0),
      outputPrice: Number(row.output_price ?? 0),
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
