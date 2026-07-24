import { BaseRepository } from '../db/base-repository';

export interface CloudCostResourceEntity {
  id: string;
  tenantId: string | null;
  provider: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  region: string;
  cost: number;
  currency: string;
  tags: Record<string, string>;
  timestamp: Date;
  environment: string | null;
  billingPeriod: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CloudCostResourceRepository extends BaseRepository<CloudCostResourceEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'cloud_cost_resources');
  }

  async findByProvider(provider: string): Promise<CloudCostResourceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_cost_resources WHERE provider = $1 ORDER BY timestamp DESC`,
      [provider],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByResourceType(resourceType: string): Promise<CloudCostResourceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_cost_resources WHERE resource_type = $1 ORDER BY timestamp DESC`,
      [resourceType],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByTenant(tenantId: string): Promise<CloudCostResourceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_cost_resources WHERE tenant_id = $1 ORDER BY timestamp DESC`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<CloudCostResourceEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM cloud_cost_resources WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp DESC`,
      [startDate, endDate],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async getTotalCostByProvider(): Promise<{ provider: string; totalCost: number }[]> {
    const result = await this.db.query(
      `SELECT provider, SUM(cost) as total_cost FROM cloud_cost_resources GROUP BY provider ORDER BY total_cost DESC`,
    );
    return result.rows.map(row => ({
      provider: row.provider,
      totalCost: Number(row.total_cost),
    }));
  }

  async getTotalCostByResourceType(): Promise<{ resourceType: string; totalCost: number }[]> {
    const result = await this.db.query(
      `SELECT resource_type, SUM(cost) as total_cost FROM cloud_cost_resources GROUP BY resource_type ORDER BY total_cost DESC`,
    );
    return result.rows.map(row => ({
      resourceType: row.resource_type,
      totalCost: Number(row.total_cost),
    }));
  }

  async getTotalCostByTenant(): Promise<{ tenantId: string; totalCost: number }[]> {
    const result = await this.db.query(
      `SELECT COALESCE(tenant_id, 'unknown') as tenant_id, SUM(cost) as total_cost FROM cloud_cost_resources GROUP BY tenant_id ORDER BY total_cost DESC`,
    );
    return result.rows.map(row => ({
      tenantId: row.tenant_id,
      totalCost: Number(row.total_cost),
    }));
  }

  protected mapRowToEntity(row: any): CloudCostResourceEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      provider: row.provider,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      region: row.region,
      cost: Number(row.cost),
      currency: row.currency,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags ?? {}),
      timestamp: row.timestamp,
      environment: row.environment,
      billingPeriod: row.billing_period,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
