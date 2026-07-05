/**
 * Audit Repository - Stub
 * Provides persistence for audit log entries.
 */

export interface CreateAuditLogInput {
  tenant_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  request_body?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  request_body?: Record<string, unknown>;
  created_at?: Date;
}

export class AuditRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }) {
    this.db = db;
  }

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    return {
      id: `audit-${Date.now()}`,
      ...input,
      created_at: new Date(),
    };
  }

  async findAll(_options: { tenantId?: string; limit?: number }): Promise<AuditLog[]> {
    return [];
  }
}
