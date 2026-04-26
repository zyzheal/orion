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
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
    const { page = 1, limit = 20, tenantId, userId, action, resourceType } = options;
    const offset = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.repository.findAll({ tenantId, userId, action, resourceType, limit, offset }),
      this.repository.count({ tenantId, userId, action }),
    ]);

    return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
    if (!input.tenant_id) throw new AuditServiceError('Tenant ID required', 'INVALID_INPUT');
    if (!input.action) throw new AuditServiceError('Action required', 'INVALID_INPUT');
    if (!input.resource_type) throw new AuditServiceError('Resource type required', 'INVALID_INPUT');

    const prevHash = await this.repository.getLatestHash(input.tenant_id);
    return this.repository.create(input, prevHash || undefined);
  }

  async verifyChain(tenantId: string): Promise<{ valid: boolean; brokenAt?: Date }> {
    return this.repository.verifyChain(tenantId);
  }

  async getActions(tenantId: string): Promise<string[]> {
    return this.repository.getActions(tenantId);
  }

  async getResourceTypes(tenantId: string): Promise<string[]> {
    return this.repository.getResourceTypes(tenantId);
  }
}