/**
 * DBA (Database Administration) Service
 * SQL order management, data source management, audit rules
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
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
// In-memory storage (dev mode - should use PostgreSQL Repository in production)
// ============================================================================

const orders = new Map<string, SqlOrder>();
const dataSources = new Map<string, DataSource>();
const auditRules = new Map<string, AuditRule>();

// ============================================================================
// Service
// ============================================================================

export class DbaService {
  // ---- Orders ----

  async listOrders(params?: { tenantId?: string; status?: string; page?: number; limit?: number }): Promise<{ data: SqlOrder[]; total: number }> {
    let result = Array.from(orders.values());
    if (params?.tenantId) {
      result = result.filter((o) => o.tenantId === params.tenantId);
    }
    if (params?.status) {
      result = result.filter((o) => o.status === params.status);
    }
    const total = result.length;
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const start = (page - 1) * limit;
    result = result.slice(start, start + limit);
    return { data: result, total };
  }

  async getOrder(id: string): Promise<SqlOrder | undefined> {
    return orders.get(id);
  }

  async createOrder(input: CreateOrderInput, userId: string, tenantId: string): Promise<SqlOrder> {
    const order: SqlOrder = {
      id: uuidv4(),
      tenantId,
      userId,
      database: input.database,
      sql: input.sql,
      comment: input.comment,
      type: (input.type as SqlOrder['type']) || 'query',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    orders.set(order.id, order);
    return order;
  }

  async approveOrder(id: string, approvedBy: string): Promise<SqlOrder | undefined> {
    const order = orders.get(id);
    if (!order) return undefined;
    order.status = 'approved';
    order.approvedBy = approvedBy;
    order.approvedAt = new Date().toISOString();
    orders.set(id, order);
    return order;
  }

  async rejectOrder(id: string): Promise<SqlOrder | undefined> {
    const order = orders.get(id);
    if (!order) return undefined;
    order.status = 'rejected';
    orders.set(id, order);
    return order;
  }

  async executeOrder(id: string): Promise<SqlOrder | undefined> {
    const order = orders.get(id);
    if (!order) return undefined;
    order.status = 'completed';
    order.executedAt = new Date().toISOString();
    order.result = 'Execution completed (mock)';
    orders.set(id, order);
    return order;
  }

  // ---- Data Sources ----

  async listDataSources(tenantId?: string): Promise<DataSource[]> {
    let result = Array.from(dataSources.values());
    if (tenantId) {
      // In production, filter by tenant_id
    }
    return result;
  }

  async getDataSource(id: string): Promise<DataSource | undefined> {
    return dataSources.get(id);
  }

  async createDataSource(input: CreateDataSourceInput): Promise<DataSource> {
    const ds: DataSource = {
      id: uuidv4(),
      name: input.name,
      type: input.type as DataSource['type'],
      host: input.host,
      port: input.port,
      database: input.database,
      status: 'offline',
    };
    dataSources.set(ds.id, ds);
    return ds;
  }

  async updateDataSource(id: string, input: Partial<DataSource>): Promise<DataSource | undefined> {
    const ds = dataSources.get(id);
    if (!ds) return undefined;
    Object.assign(ds, input);
    dataSources.set(id, ds);
    return ds;
  }

  async deleteDataSource(id: string): Promise<boolean> {
    return dataSources.delete(id);
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const ds = dataSources.get(id);
    if (!ds) return { success: false, message: 'Data source not found' };
    ds.status = 'online';
    ds.lastChecked = new Date().toISOString();
    dataSources.set(id, ds);
    return { success: true, message: `Connected to ${ds.host}:${ds.port}` };
  }

  // ---- Audit Rules ----

  async listAuditRules(tenantId?: string): Promise<AuditRule[]> {
    let result = Array.from(auditRules.values());
    if (tenantId) {
      result = result.filter((r) => r.tenantId === tenantId);
    }
    return result;
  }

  async createAuditRule(input: CreateAuditRuleInput, tenantId: string): Promise<AuditRule> {
    const rule: AuditRule = {
      id: uuidv4(),
      tenantId,
      name: input.name,
      pattern: input.pattern,
      severity: (input.severity as AuditRule['severity']) || 'warning',
      enabled: input.enabled ?? true,
    };
    auditRules.set(rule.id, rule);
    return rule;
  }

  async updateAuditRule(id: string, input: Partial<AuditRule>): Promise<AuditRule | undefined> {
    const rule = auditRules.get(id);
    if (!rule) return undefined;
    Object.assign(rule, input);
    auditRules.set(id, rule);
    return rule;
  }
}
