import { BaseRepository } from '../db/base-repository';

export interface ModuleRegistryEntity {
  id: string;
  name: string;
  description: string | null;
  level: string;
  domain: string | null;
  state: string;
  enabled: boolean;
  autoStart: boolean;
  dependencies: string[];
  priority: number;
  routePrefix: string | null;
  error: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ModuleRegistryRepository extends BaseRepository<ModuleRegistryEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'module_registry');
  }

  async findByLevel(level: string): Promise<ModuleRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM module_registry WHERE level = $1 ORDER BY priority, name`,
      [level],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByState(state: string): Promise<ModuleRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM module_registry WHERE state = $1 ORDER BY priority, name`,
      [state],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findEnabled(): Promise<ModuleRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM module_registry WHERE enabled = true ORDER BY priority, name`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByDomain(domain: string): Promise<ModuleRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM module_registry WHERE domain = $1 ORDER BY priority, name`,
      [domain],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async upsertModule(id: string, data: Partial<ModuleRegistryEntity>): Promise<ModuleRegistryEntity | null> {
    const existing = await this.findById(id);
    if (existing) {
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.level !== undefined) updateData.level = data.level;
      if (data.domain !== undefined) updateData.domain = data.domain;
      if (data.state !== undefined) updateData.state = data.state;
      if (data.enabled !== undefined) updateData.enabled = data.enabled;
      if (data.autoStart !== undefined) updateData.auto_start = data.autoStart;
      if (data.dependencies !== undefined) updateData.dependencies = JSON.stringify(data.dependencies);
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.routePrefix !== undefined) updateData.route_prefix = data.routePrefix;
      if (data.error !== undefined) updateData.error = data.error;
      if (Object.keys(updateData).length === 0) return existing;
      return this.update(id, updateData);
    }
    return this.create({
      id,
      name: data.name || id,
      description: data.description || null,
      level: data.level || 'service',
      domain: data.domain || null,
      state: data.state || 'registered',
      enabled: data.enabled ?? true,
      auto_start: data.autoStart ?? true,
      dependencies: JSON.stringify(data.dependencies || []),
      priority: data.priority ?? 100,
      route_prefix: data.routePrefix || null,
      error: data.error || null,
      tenant_id: data.tenantId || null,
    });
  }

  async updateState(id: string, state: string, error?: string): Promise<ModuleRegistryEntity | null> {
    return this.update(id, {
      state,
      error: error || null,
    });
  }

  async findAllModules(): Promise<ModuleRegistryEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM module_registry ORDER BY priority, name`,
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): ModuleRegistryEntity {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      level: row.level,
      domain: row.domain,
      state: row.state,
      enabled: row.enabled,
      autoStart: row.auto_start,
      dependencies: typeof row.dependencies === 'string' ? JSON.parse(row.dependencies) : (row.dependencies || []),
      priority: row.priority ?? 100,
      routePrefix: row.route_prefix,
      error: row.error,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
