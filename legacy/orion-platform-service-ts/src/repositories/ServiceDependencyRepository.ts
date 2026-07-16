import { BaseRepository } from '../db/base-repository';

export interface ServiceDependencyEntity {
  id: string;
  tenantId: string;
  dependsOn: string[];
  dependencyType: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ServiceDependencyRepository extends BaseRepository<ServiceDependencyEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'service_dependencies');
  }

  async findByTenantId(tenantId: string): Promise<ServiceDependencyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM service_dependencies WHERE tenant_id = $1 ORDER BY id`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByService(service: string): Promise<ServiceDependencyEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM service_dependencies WHERE id = $1`,
      [service],
    );
    return result.rows.length > 0 ? this.mapRowToEntity(result.rows[0]) : undefined;
  }

  async findDependentsOf(service: string): Promise<ServiceDependencyEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM service_dependencies WHERE $1 = ANY(depends_on)`,
      [service],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertDependency(service: string, tenantId: string, dependsOn: string[], dependencyType: string): Promise<void> {
    await this.db.query(
      `INSERT INTO service_dependencies (id, tenant_id, depends_on, dependency_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         depends_on = EXCLUDED.depends_on,
         dependency_type = EXCLUDED.dependency_type,
         updated_at = NOW()`,
      [service, tenantId, dependsOn, dependencyType],
    );
  }

  protected mapRowToEntity(row: any): ServiceDependencyEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      dependsOn: row.depends_on || [],
      dependencyType: row.dependency_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
