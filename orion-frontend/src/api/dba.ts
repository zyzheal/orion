/**
 * DBA (Database Administration) API Service
 * SQL order management, data source management, audit
 */
import { api } from './client';

export interface SqlOrder {
  id: string;
  tenantId: string;
  userId: string;
  database: string;
  sql: string;
  comment: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  type: 'query' | 'insert' | 'update' | 'delete' | 'ddl';
  createdAt: string;
  executedAt?: string;
  result?: string;
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

export interface CreateOrderInput {
  database: string;
  sql: string;
  comment: string;
  type?: string;
}

export interface AuditRule {
  id: string;
  tenantId: string;
  name: string;
  pattern: string;
  severity: 'info' | 'warning' | 'error';
  enabled: boolean;
}

// ---- Orders ----

export function listOrders(params?: {
  tenantId?: string;
  page?: number;
  limit?: number;
  status?: string;
}) {
  return api.get('/dba/orders', { params });
}

export function getOrder(id: string) {
  return api.get(`/dba/orders/${id}`);
}

export function createOrder(data: CreateOrderInput) {
  return api.post('/dba/orders', data);
}

export function approveOrder(id: string) {
  return api.post(`/dba/orders/${id}/approve`);
}

export function rejectOrder(id: string, reason: string) {
  return api.post(`/dba/orders/${id}/reject`, { reason });
}

export function executeOrder(id: string) {
  return api.post(`/dba/orders/${id}/execute`);
}

// ---- Data Sources ----

export function listDataSources(tenantId: string) {
  return api.get('/dba/datasources', { params: { tenantId } });
}

export function createDataSource(data: Omit<DataSource, 'id' | 'status'>) {
  return api.post('/dba/datasources', data);
}

export function updateDataSource(id: string, data: Partial<DataSource>) {
  return api.put(`/dba/datasources/${id}`, data);
}

export function deleteDataSource(id: string) {
  return api.delete(`/dba/datasources/${id}`);
}

export function testConnection(id: string) {
  return api.post(`/dba/datasources/${id}/test`);
}

// ---- Audit Rules ----

export function listAuditRules(tenantId: string) {
  return api.get('/dba/audit-rules', { params: { tenantId } });
}

export function createAuditRule(data: Omit<AuditRule, 'id'>) {
  return api.post('/dba/audit-rules', data);
}

export function updateAuditRule(id: string, data: Partial<AuditRule>) {
  return api.put(`/dba/audit-rules/${id}`, data);
}

// ---- Query Execution ----

export function executeQuery(sourceId: string, sql: string, limit?: number) {
  return api.post('/dba/query', { sourceId, sql, limit: limit || 100 });
}
