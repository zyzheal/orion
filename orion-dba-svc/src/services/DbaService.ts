/**
 * DBA Service - SQL 审核代理
 *
 * 代理 Yearning Java 后端服务，提供统一的 HTTP 接口
 * 同时集成 NATS 事件总线和租户隔离
 */

import { config } from '../config';
import type {
  SqlOrder,
  DataSource,
  AuditRule,
  UserPermission,
  CreateOrderInput,
  ExecuteOrderInput,
  DbaQuery,
} from '../types/dba';

export class DbaService {
  private yearningUrl: string;
  private apiKey: string;

  constructor() {
    this.yearningUrl = config.yearning.url;
    this.apiKey = config.yearning.apiKey;
  }

  private async proxyToYearning(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${this.yearningUrl}/api${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(config.yearning.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Yearning backend error (${response.status}): ${error}`);
    }

    return response.json();
  }

  // ==================== SQL Orders ====================

  async createOrder(tenantId: string, userId: string, input: CreateOrderInput): Promise<SqlOrder> {
    const result = await this.proxyToYearning('POST', '/v1/orders', {
      ...input,
      tenantId,
      userId,
    });
    return result.data;
  }

  async listOrders(query: DbaQuery): Promise<{ data: SqlOrder[]; total: number }> {
    const result = await this.proxyToYearning('GET', `/v1/orders?tenantId=${query.tenantId}&status=${query.status || ''}&page=${query.page || 1}&limit=${query.limit || 20}`);
    return result.data;
  }

  async getOrder(id: string): Promise<SqlOrder | null> {
    const result = await this.proxyToYearning('GET', `/v1/orders/${id}`);
    return result.data;
  }

  async approveOrder(id: string, userId: string): Promise<SqlOrder> {
    const result = await this.proxyToYearning('POST', `/v1/orders/${id}/approve`, { userId });
    return result.data;
  }

  async rejectOrder(id: string, userId: string, reason: string): Promise<SqlOrder> {
    const result = await this.proxyToYearning('POST', `/v1/orders/${id}/reject`, { userId, reason });
    return result.data;
  }

  async executeOrder(input: ExecuteOrderInput): Promise<SqlOrder> {
    const result = await this.proxyToYearning('POST', `/v1/orders/${input.orderId}/execute`, {
      executedBy: input.executedBy,
    });
    return result.data;
  }

  // ==================== Data Sources ====================

  async listDataSources(tenantId: string): Promise<DataSource[]> {
    const result = await this.proxyToYearning('GET', `/v1/sources?tenantId=${tenantId}`);
    return result.data;
  }

  async createDataSource(tenantId: string, input: Omit<DataSource, 'id' | 'status' | 'lastChecked'>): Promise<DataSource> {
    const result = await this.proxyToYearning('POST', '/v1/sources', {
      ...input,
      tenantId,
    });
    return result.data;
  }

  async updateDataSource(id: string, input: Partial<DataSource>): Promise<DataSource> {
    const result = await this.proxyToYearning('PUT', `/v1/sources/${id}`, input);
    return result.data;
  }

  async deleteDataSource(id: string): Promise<void> {
    await this.proxyToYearning('DELETE', `/v1/sources/${id}`);
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.proxyToYearning('POST', `/v1/sources/${id}/test`);
    return result.data;
  }

  // ==================== Audit Rules ====================

  async listAuditRules(tenantId: string): Promise<AuditRule[]> {
    const result = await this.proxyToYearning('GET', `/v1/rules?tenantId=${tenantId}`);
    return result.data;
  }

  async createAuditRule(tenantId: string, input: Omit<AuditRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuditRule> {
    const result = await this.proxyToYearning('POST', '/v1/rules', {
      ...input,
      tenantId,
    });
    return result.data;
  }

  async updateAuditRule(id: string, input: Partial<AuditRule>): Promise<AuditRule> {
    const result = await this.proxyToYearning('PUT', `/v1/rules/${id}`, input);
    return result.data;
  }

  // ==================== User Permissions ====================

  async getUserPermissions(userId: string, tenantId: string): Promise<UserPermission> {
    const result = await this.proxyToYearning('GET', `/v1/permissions?userId=${userId}&tenantId=${tenantId}`);
    return result.data;
  }

  async updateUserPermissions(userId: string, tenantId: string, input: Partial<UserPermission>): Promise<UserPermission> {
    const result = await this.proxyToYearning('PUT', `/v1/permissions`, {
      userId,
      tenantId,
      ...input,
    });
    return result.data;
  }

  // ==================== SQL Query ====================

  async executeQuery(sourceId: string, sql: string, limit = 100): Promise<{ columns: string[]; rows: unknown[][] }> {
    const result = await this.proxyToYearning('POST', '/v1/query', {
      sourceId,
      sql,
      limit,
    });
    return result.data;
  }
}
