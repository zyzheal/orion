/**
 * DependencyTracker - Dependency tracking across domains
 *
 * Tracks dependencies between pipeline changes and infrastructure,
 * detects potential impact of changes across domains.
 *
 * PostgreSQL Repository pattern — database is the single source of truth.
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabasePool } from '../database';
import { OrionError, ErrorCode } from '../../errors';

export type DependencyType = 'hard' | 'soft' | 'optional';
export type DependencyStatus = 'active' | 'resolved' | 'violated';
export type DomainType = 'pipeline' | 'infrastructure' | 'deployment' | 'monitoring' | 'security';

export interface CrossDomainDependency {
  id: string;
  tenantId: string;
  sourceDomain: DomainType;
  sourceId: string;
  sourceName: string;
  targetDomain: DomainType;
  targetId: string;
  targetName: string;
  type: DependencyType;
  status: DependencyStatus;
  description?: string;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface ChangeImpact {
  changeId: string;
  changeDescription: string;
  sourceDomain: DomainType;
  impactedDependencies: CrossDomainDependency[];
  impactSummary: {
    high: number;
    medium: number;
    low: number;
    critical: number;
  };
  requiresApproval: boolean;
}

export interface CreateDependencyInput {
  sourceDomain: DomainType;
  sourceId: string;
  sourceName: string;
  targetDomain: DomainType;
  targetId: string;
  targetName: string;
  type: DependencyType;
  description?: string;
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================
// Repository
// ============================================================

class DependencyRepository {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    if (!pool) throw new Error('DatabasePool is required');
    this.pool = pool;
  }

  async save(dep: CrossDomainDependency): Promise<void> {
    await this.pool.query(
      `INSERT INTO cross_domain_dependencies (
        id, tenant_id, source_domain, source_id, source_name,
        target_domain, target_id, target_name, type, status,
        description, impact_level, created_by, created_at, updated_at, resolved_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (id) DO UPDATE SET
        status=EXCLUDED.status, description=EXCLUDED.description,
        impact_level=EXCLUDED.impact_level, updated_at=EXCLUDED.updated_at,
        resolved_at=EXCLUDED.resolved_at`,
      [
        dep.id, dep.tenantId, dep.sourceDomain, dep.sourceId, dep.sourceName,
        dep.targetDomain, dep.targetId, dep.targetName, dep.type, dep.status,
        dep.description || null, dep.impactLevel, dep.createdBy,
        dep.createdAt, dep.updatedAt, dep.resolvedAt || null,
      ]
    );
  }

  async findByTenant(tenantId: string): Promise<CrossDomainDependency[]> {
    const rows = (await this.pool.query('SELECT * FROM cross_domain_dependencies WHERE tenant_id = $1', [tenantId])).rows;
    return rows.map((r: any) => this.rowToDep(r));
  }

  async findBySource(tenantId: string, domain: DomainType, resourceId: string): Promise<CrossDomainDependency[]> {
    const rows = (await this.pool.query(
      'SELECT * FROM cross_domain_dependencies WHERE tenant_id = $1 AND source_domain = $2 AND source_id = $3',
      [tenantId, domain, resourceId]
    )).rows;
    return rows.map((r: any) => this.rowToDep(r));
  }

  async findById(id: string): Promise<CrossDomainDependency | null> {
    const rows = (await this.pool.query('SELECT * FROM cross_domain_dependencies WHERE id = $1', [id])).rows;
    return rows.length ? this.rowToDep(rows[0]) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM cross_domain_dependencies WHERE id = $1', [id]);
    return (result as any).rowCount > 0;
  }

  private rowToDep(row: any): CrossDomainDependency {
    return {
      id: row.id, tenantId: row.tenant_id,
      sourceDomain: row.source_domain as DomainType, sourceId: row.source_id, sourceName: row.source_name,
      targetDomain: row.target_domain as DomainType, targetId: row.target_id, targetName: row.target_name,
      type: row.type as DependencyType, status: row.status as DependencyStatus,
      description: row.description || undefined, impactLevel: row.impact_level as CrossDomainDependency['impactLevel'],
      createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at, resolvedAt: row.resolved_at || undefined,
    };
  }
}

// ============================================================
// Service
// ============================================================

export class DependencyTracker {
  private repository: DependencyRepository;

  constructor(database: DatabasePool) {
    if (!database) throw new Error('DatabasePool is required for DependencyTracker');
    this.repository = new DependencyRepository(database);
  }

  async addDependency(tenantId: string, input: CreateDependencyInput, createdBy: string): Promise<CrossDomainDependency> {
    const now = new Date();
    const dep: CrossDomainDependency = {
      id: uuidv4(), tenantId,
      sourceDomain: input.sourceDomain, sourceId: input.sourceId, sourceName: input.sourceName,
      targetDomain: input.targetDomain, targetId: input.targetId, targetName: input.targetName,
      type: input.type, status: 'active', description: input.description,
      impactLevel: input.impactLevel, createdBy, createdAt: now, updatedAt: now,
    };
    await this.repository.save(dep);
    return dep;
  }

  async getDependencies(tenantId: string): Promise<CrossDomainDependency[]> {
    return this.repository.findByTenant(tenantId);
  }

  async getSourceDependencies(tenantId: string, domain: DomainType, resourceId: string): Promise<CrossDomainDependency[]> {
    return this.repository.findBySource(tenantId, domain, resourceId);
  }

  async assessImpact(tenantId: string, domain: DomainType, resourceId: string, changeDescription: string): Promise<ChangeImpact> {
    const deps = await this.repository.findBySource(tenantId, domain, resourceId);
    const summary = { high: 0, medium: 0, low: 0, critical: 0 };
    for (const dep of deps) {
      if (dep.status === 'active') summary[dep.impactLevel]++;
    }
    return {
      changeId: uuidv4(),
      changeDescription,
      sourceDomain: domain,
      impactedDependencies: deps.filter(d => d.status === 'active'),
      impactSummary: summary,
      requiresApproval: summary.critical > 0 || summary.high > 0,
    };
  }

  async resolveDependency(id: string): Promise<CrossDomainDependency> {
    const dep = await this.repository.findById(id);
    if (!dep) throw new OrionError(`Dependency '${id}' not found`, ErrorCode.NOT_FOUND);
    dep.status = 'resolved';
    dep.resolvedAt = new Date();
    dep.updatedAt = new Date();
    await this.repository.save(dep);
    return dep;
  }

  async deleteDependency(id: string): Promise<boolean> {
    return this.repository.deleteById(id);
  }
}
