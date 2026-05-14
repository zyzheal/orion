import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({ name: 'audit-repository' });

export interface AuditLogEntry {
  id: string;
  sequenceNumber: number;
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestMethod?: string;
  requestPath?: string;
  requestBody?: Record<string, any>;
  responseCode?: number;
  responseBody?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  prevHash: string;
  hash: string;
  createdAt: Date;
}

export interface AuditCreateInput {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestMethod?: string;
  requestPath?: string;
  requestBody?: Record<string, any>;
  responseCode?: number;
  responseBody?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  verifiedCount: number;
  totalCount: number;
  breaks: Array<{
    sequenceNumber: number;
    entryId: string;
    breakType: string;
    description: string;
  }>;
}

export class AuditRepository {
  constructor(private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {}

  async create(input: AuditCreateInput): Promise<AuditLogEntry> {
    const lastEntry = await this.getLastEntry();
    const prevHash = lastEntry?.hash ?? '0'.repeat(64);
    const nextSequence = lastEntry ? lastEntry.sequenceNumber + 1 : 1;

    const id = uuidv4();
    const content = JSON.stringify({ id, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId, sequenceNumber: nextSequence });
    const hash = createHash('sha256').update(prevHash + content).digest('hex');

    const result = await this.db.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, request_method, request_path, request_body, response_code, response_body, ip_address, user_agent, prev_hash, hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [id, input.tenantId, input.userId || null, input.action, input.resourceType, input.resourceId || null, input.requestMethod || null, input.requestPath || null, input.requestBody ? JSON.stringify(input.requestBody) : null, input.responseCode || null, input.responseBody ? JSON.stringify(input.responseBody) : null, input.ipAddress || null, input.userAgent || null, prevHash, hash],
    );

    logger.debug({ id, sequenceNumber: nextSequence, action: input.action }, 'Audit log entry created');
    return this.mapRow(result.rows[0]);
  }

  async getLastEntry(): Promise<AuditLogEntry | undefined> {
    const result = await this.db.query(`SELECT * FROM audit_logs ORDER BY sequence_number DESC LIMIT 1`);
    if (result.rows.length === 0) return undefined;
    return this.mapRow(result.rows[0]);
  }

  async getEntries(options?: { startSequence?: number; endSequence?: number; limit?: number }): Promise<AuditLogEntry[]> {
    const start = options?.startSequence || 1;
    const end = options?.endSequence || Number.MAX_SAFE_INTEGER;
    const limit = options?.limit || 1000;

    const result = await this.db.query(
      `SELECT * FROM audit_logs WHERE sequence_number >= $1 AND sequence_number <= $2 ORDER BY sequence_number ASC LIMIT $3`,
      [start, end, limit],
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async getNextSequenceNumber(): Promise<number> {
    const result = await this.db.query(`SELECT COALESCE(MAX(sequence_number), 0) as max_seq FROM audit_logs`);
    return (result.rows[0]?.max_seq || 0) + 1;
  }

  async verifyChain(options?: { startSequence?: number; endSequence?: number }): Promise<ChainVerificationResult> {
    const entries = await this.getEntries(options);
    const breaks: ChainVerificationResult['breaks'] = [];
    let expectedPrevHash = '0'.repeat(64);
    let verifiedCount = 0;

    for (const entry of entries) {
      if (entry.prevHash !== expectedPrevHash) {
        breaks.push({ sequenceNumber: entry.sequenceNumber, entryId: entry.id, breakType: 'HASH_MISMATCH', description: `Chain hash mismatch at sequence ${entry.sequenceNumber}` });
      }
      const content = JSON.stringify({ id: entry.id, action: entry.action, resourceType: entry.resourceType, resourceId: entry.resourceId, sequenceNumber: entry.sequenceNumber });
      const computedHash = createHash('sha256').update(entry.prevHash + content).digest('hex');
      if (computedHash !== entry.hash) {
        breaks.push({ sequenceNumber: entry.sequenceNumber, entryId: entry.id, breakType: 'MODIFIED_CONTENT', description: `Content hash mismatch at sequence ${entry.sequenceNumber}` });
      }
      expectedPrevHash = entry.hash;
      verifiedCount++;
    }

    return { valid: breaks.length === 0, verifiedCount, totalCount: entries.length, breaks };
  }

  private mapRow(row: any): AuditLogEntry {
    return {
      id: row.id, sequenceNumber: row.sequence_number ?? 0, tenantId: row.tenant_id, userId: row.user_id,
      action: row.action, resourceType: row.resource_type, resourceId: row.resource_id,
      requestMethod: row.request_method, requestPath: row.request_path, requestBody: row.request_body,
      responseCode: row.response_code, responseBody: row.response_body, ipAddress: row.ip_address,
      userAgent: row.user_agent, prevHash: row.prev_hash, hash: row.hash, createdAt: row.created_at,
    };
  }
}
