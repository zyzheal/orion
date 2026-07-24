/**
 * AuditService - Business logic layer for Audit operations
 */

import { AuditRepository, AuditLog, CreateAuditLogInput } from './AuditRepository';

export interface ListAuditLogsOptions {
  page?: number;
  limit?: number;
  tenantId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ExportFormat = 'csv' | 'json';

export interface ExportAuditLogsOptions {
  tenantId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  format?: ExportFormat;
}

export class AuditServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuditServiceError';
  }
}

export class AuditService {
  private repository: AuditRepository;

  constructor(repository: AuditRepository) {
    this.repository = repository;
  }

  async getAuditLog(id: string): Promise<AuditLog> {
    const log = await this.repository.findById(id);
    if (!log) throw new AuditServiceError(`Audit log not found: ${id}`, 'NOT_FOUND');
    return log;
  }

  async listAuditLogs(options: ListAuditLogsOptions = {}): Promise<PaginatedResult<AuditLog>> {
    const { page = 1, limit = 20, tenantId, userId, action, resourceType, resourceId, dateFrom, dateTo } = options;
    const offset = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.repository.findAll({ tenantId, userId, action, resourceType, resourceId, dateFrom, dateTo, limit, offset }),
      this.repository.count({ tenantId, userId, action, resourceType, resourceId, dateFrom, dateTo }),
    ]);

    return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async exportAuditLogs(options: ExportAuditLogsOptions = {}): Promise<{ content: string; format: ExportFormat; filename: string }> {
    const { tenantId, userId, action, resourceType, resourceId, dateFrom, dateTo, format = 'json' } = options;

    const logs = await this.repository.findAll({
      tenantId,
      userId,
      action,
      resourceType,
      resourceId,
      dateFrom,
      dateTo,
      limit: 10000,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      const csv = this.convertToCsv(logs);
      return {
        content: csv,
        format: 'csv',
        filename: `audit-logs-${timestamp}.csv`,
      };
    }

    const json = JSON.stringify(logs, null, 2);
    return {
      content: json,
      format: 'json',
      filename: `audit-logs-${timestamp}.json`,
    };
  }

  private convertToCsv(logs: AuditLog[]): string {
    const headers = [
      'id', 'tenant_id', 'user_id', 'action', 'resource_type', 'resource_id',
      'request_method', 'request_path', 'request_body', 'response_code', 'response_body',
      'ip_address', 'user_agent', 'prev_hash', 'hash', 'created_at',
    ];

    const rows = logs.map(log => [
      log.id,
      log.tenant_id,
      log.user_id ?? '',
      log.action,
      log.resource_type,
      log.resource_id ?? '',
      log.request_method ?? '',
      log.request_path ?? '',
      JSON.stringify(log.request_body ?? {}).replace(/"/g, '""'),
      log.response_code ?? '',
      JSON.stringify(log.response_body ?? {}).replace(/"/g, '""'),
      log.ip_address ?? '',
      log.user_agent ?? '',
      log.prev_hash ?? '',
      log.hash,
      log.created_at.toISOString(),
    ]);

    const escape = (val: string) => `"${val}"`;
    const csvRows = [headers.map(escape).join(',')];
    for (const row of rows) {
      csvRows.push(row.map(v => typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n')) ? escape(v) : v).join(','));
    }
    return csvRows.join('\n');
  }

  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
    if (!input.tenant_id) throw new AuditServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.action) throw new AuditServiceError('Action required', 'INVALID_INPUT');
    if (!input.resource_type) throw new AuditServiceError('Resource type required', 'INVALID_INPUT');

    const prevHash = await this.repository.getLatestHash(input.tenant_id);
    return this.repository.create(input, prevHash || undefined);
  }

  async verifyChain(tenantId: string): Promise<{ valid: boolean; brokenAt?: Date; totalVerified?: number }> {
    return this.repository.verifyChain(tenantId);
  }

  async getActions(tenantId: string): Promise<string[]> {
    return this.repository.getActions(tenantId);
  }

  async getResourceTypes(tenantId: string): Promise<string[]> {
    return this.repository.getResourceTypes(tenantId);
  }
}