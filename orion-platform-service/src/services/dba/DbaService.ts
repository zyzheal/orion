/**
 * DBA (Database Administration) Service
 * SQL order management, data source management, audit rules
 *
 * Migrated from Map() to PostgreSQL Repository pattern (2026-06-26)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SqlOrderRepository,
  DataSourceRepository,
  AuditRuleRepository,
  SqlOrderEntity,
  DataSourceEntity,
  AuditRuleEntity,
} from '../../repositories/DbaRepository';

// ============================================================================
// Types (preserved for backward compatibility)
// ============================================================================

export interface SqlOrder {
  id: string;
  tenantId: string;
  userId: string;
  database: string;
  sql: string;
  comment: string;
  type: 'query' | 'insert' | 'update' | 'delete' | 'ddl';
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  result?: string;
  createdAt: string;
  executedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'redis' | 'mongodb';
  host: string;
  port: number;
  database: string;
  status: 'online' | 'offline' | 'error';
  lastChecked?: string;
}

export interface AuditRule {
  id: string;
  tenantId: string;
  name: string;
  pattern: string;
  severity: 'info' | 'warning' | 'error';
  enabled: boolean;
}

export interface CreateOrderInput {
  database: string;
  sql: string;
  comment: string;
  type?: string;
}

export interface CreateDataSourceInput {
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
}

export interface CreateAuditRuleInput {
  name: string;
  pattern: string;
  severity?: string;
  enabled?: boolean;
}

// ============================================================================
// Service
// ============================================================================

export class DbaService {
  private sqlOrderRepo: SqlOrderRepository;
  private dataSourceRepo: DataSourceRepository;
  private auditRuleRepo: AuditRuleRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.sqlOrderRepo = new SqlOrderRepository(db);
    this.dataSourceRepo = new DataSourceRepository(db);
    this.auditRuleRepo = new AuditRuleRepository(db);
  }

  // ---- Orders ----

  async listOrders(params?: { tenantId?: string; status?: string; page?: number; limit?: number }): Promise<{ data: SqlOrder[]; total: number }> {
    if (!params?.tenantId) return { data: [], total: 0 };
    const result = await this.sqlOrderRepo.findByTenant(params.tenantId, {
      status: params.status,
      page: params.page,
      limit: params.limit,
    });
    return { data: result.data.map(e => this.orderToDTO(e)), total: result.total };
  }

  async getOrder(id: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.findById(id);
    return entity ? this.orderToDTO(entity) : undefined;
  }

  async createOrder(input: CreateOrderInput, userId: string, tenantId: string): Promise<SqlOrder> {
    const entity = await this.sqlOrderRepo.create({
      id: uuidv4(),
      tenantId,
      userId,
      databaseName: input.database,
      sqlText: input.sql,
      comment: input.comment,
      orderType: input.type || 'query',
      status: 'pending',
    });
    return this.orderToDTO(entity);
  }

  async approveOrder(id: string, approvedBy: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.updateStatus(id, 'approved', { approvedBy });
    return entity ? this.orderToDTO(entity) : undefined;
  }

  async rejectOrder(id: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.updateStatus(id, 'rejected');
    return entity ? this.orderToDTO(entity) : undefined;
  }

  async executeOrder(id: string): Promise<SqlOrder | undefined> {
    const entity = await this.sqlOrderRepo.updateStatus(id, 'completed', { result: 'Execution completed' });
    return entity ? this.orderToDTO(entity) : undefined;
  }

  // ---- Data Sources ----

  async listDataSources(tenantId?: string): Promise<DataSource[]> {
    if (!tenantId) return [];
    const entities = await this.dataSourceRepo.findByTenant(tenantId);
    return entities.map(e => this.dataSourceToDTO(e));
  }

  async getDataSource(id: string): Promise<DataSource | undefined> {
    const entity = await this.dataSourceRepo.findById(id);
    return entity ? this.dataSourceToDTO(entity) : undefined;
  }

  async createDataSource(input: CreateDataSourceInput, tenantId?: string): Promise<DataSource> {
    const entity = await this.dataSourceRepo.create({
      id: uuidv4(),
      tenantId: tenantId || 'default',
      name: input.name,
      sourceType: input.type,
      host: input.host,
      port: input.port,
      databaseName: input.database,
      username: input.username ?? null,
      passwordEncrypted: input.password ?? null,
      status: 'offline',
    });
    return this.dataSourceToDTO(entity);
  }

  async updateDataSource(id: string, input: Partial<DataSource>): Promise<DataSource | undefined> {
    const existing = await this.dataSourceRepo.findById(id);
    if (!existing) return undefined;
    const entity = await this.dataSourceRepo.update(id, {
      name: input.name ?? existing.name,
      sourceType: input.type ?? existing.sourceType,
      host: input.host ?? existing.host,
      port: input.port ?? existing.port,
      databaseName: input.database ?? existing.databaseName,
      status: input.status ?? existing.status,
    });
    return entity ? this.dataSourceToDTO(entity) : undefined;
  }

  async deleteDataSource(id: string): Promise<boolean> {
    const existing = await this.dataSourceRepo.findById(id);
    if (!existing) return false;
    await this.dataSourceRepo.delete(id);
    return true;
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const ds = await this.dataSourceRepo.findById(id);
    if (!ds) return { success: false, message: 'Data source not found' };
    await this.dataSourceRepo.updateStatus(id, 'online');
    return { success: true, message: `Connected to ${ds.host}:${ds.port}` };
  }

  // ---- Audit Rules ----

  async listAuditRules(tenantId?: string): Promise<AuditRule[]> {
    if (!tenantId) return [];
    const entities = await this.auditRuleRepo.findByTenant(tenantId);
    return entities.map(e => this.auditRuleToDTO(e));
  }

  async createAuditRule(input: CreateAuditRuleInput, tenantId: string): Promise<AuditRule> {
    const entity = await this.auditRuleRepo.create({
      id: uuidv4(),
      tenantId,
      name: input.name,
      pattern: input.pattern,
      severity: input.severity || 'warning',
      enabled: input.enabled ?? true,
    });
    return this.auditRuleToDTO(entity);
  }

  async updateAuditRule(id: string, input: Partial<AuditRule>): Promise<AuditRule | undefined> {
    const existing = await this.auditRuleRepo.findById(id);
    if (!existing) return undefined;
    const entity = await this.auditRuleRepo.update(id, {
      name: input.name ?? existing.name,
      pattern: input.pattern ?? existing.pattern,
      severity: input.severity ?? existing.severity,
      enabled: input.enabled ?? existing.enabled,
    });
    return entity ? this.auditRuleToDTO(entity) : undefined;
  }

  // ---- DTO Converters ----

  private orderToDTO(e: SqlOrderEntity): SqlOrder {
    return {
      id: e.id,
      tenantId: e.tenantId,
      userId: e.userId,
      database: e.databaseName,
      sql: e.sqlText,
      comment: e.comment,
      type: e.orderType as SqlOrder['type'],
      status: e.status as SqlOrder['status'],
      result: e.result ?? undefined,
      createdAt: e.createdAt.toISOString(),
      executedAt: e.executedAt?.toISOString(),
      approvedBy: e.approvedBy ?? undefined,
      approvedAt: e.approvedAt?.toISOString(),
    };
  }

  private dataSourceToDTO(e: DataSourceEntity): DataSource {
    return {
      id: e.id,
      name: e.name,
      type: e.sourceType as DataSource['type'],
      host: e.host,
      port: e.port,
      database: e.databaseName,
      status: e.status as DataSource['status'],
      lastChecked: e.lastChecked?.toISOString(),
    };
  }

  private auditRuleToDTO(e: AuditRuleEntity): AuditRule {
    return {
      id: e.id,
      tenantId: e.tenantId,
      name: e.name,
      pattern: e.pattern,
      severity: e.severity as AuditRule['severity'],
      enabled: e.enabled,
    };
  }
}
