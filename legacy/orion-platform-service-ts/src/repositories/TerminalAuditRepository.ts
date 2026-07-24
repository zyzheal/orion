/**
 * TerminalAuditRepository — PostgreSQL data access for terminal audit logs
 *
 * Covers 2 tables:
 * - terminal_connect_logs
 * - terminal_file_logs
 */

import { getCurrentTenantId } from '../db/tenant-context-storage';
import { OrionError, ErrorCode } from '../errors';

// ==================== Entity Interfaces ====================

export interface TerminalConnectLogEntity {
  id: string;
  tenant_id: string;
  username: string;
  hostname: string;
  host_ip: string;
  connect_time: Date;
  disconnect_time: Date | null;
  duration: string | null;
  status: 'active' | 'closed' | 'terminated';
  client_ip: string;
  created_at: Date;
}

export interface TerminalFileLogEntity {
  id: string;
  tenant_id: string;
  username: string;
  hostname: string;
  file_path: string;
  file_name: string;
  file_size: string;
  operation: 'upload' | 'download';
  timestamp: Date;
  status: 'success' | 'failed';
  created_at: Date;
}

// ==================== Input Interfaces ====================

export interface CreateConnectLogInput {
  username: string;
  hostname: string;
  hostIp: string;
  connectTime: Date;
  disconnectTime?: Date;
  duration?: string;
  status?: string;
  clientIp: string;
  tenantId?: string;
}

export interface CreateFileLogInput {
  username: string;
  hostname: string;
  filePath: string;
  fileName: string;
  fileSize: string;
  operation: 'upload' | 'download';
  timestamp: Date;
  status?: string;
  tenantId?: string;
}

// ==================== Repository ====================

export class TerminalAuditRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  private getTenantId(override?: string): string {
    return override || getCurrentTenantId();
  }

  // ==================== Connect Logs ====================

  async createConnectLog(input: CreateConnectLogInput): Promise<TerminalConnectLogEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO terminal_connect_logs (tenant_id, username, hostname, host_ip, connect_time, disconnect_time, duration, status, client_ip, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId,
        input.username,
        input.hostname,
        input.hostIp,
        input.connectTime,
        input.disconnectTime || null,
        input.duration || null,
        input.status || 'active',
        input.clientIp,
        now,
      ]
    );
    return this.mapConnectLogRow(result.rows[0]);
  }

  async findConnectLogById(id: string, tenantId?: string): Promise<TerminalConnectLogEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM terminal_connect_logs WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapConnectLogRow(result.rows[0]);
  }

  async findAllConnectLogs(tenantId?: string, options?: { page?: number; pageSize?: number; status?: string }): Promise<{ entities: TerminalConnectLogEntity[]; total: number }> {
    const tId = this.getTenantId(tenantId);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    let countQuery = `SELECT COUNT(*) as count FROM terminal_connect_logs WHERE tenant_id = $1`;
    let dataQuery = `SELECT * FROM terminal_connect_logs WHERE tenant_id = $1`;
    const params: unknown[] = [tId];
    let paramIndex = 2;

    if (options?.status) {
      countQuery += ` AND status = $${paramIndex}`;
      dataQuery += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    dataQuery += ` ORDER BY connect_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, offset);

    const result = await this.db.query(dataQuery, params);
    return {
      entities: result.rows.map(row => this.mapConnectLogRow(row)),
      total,
    };
  }

  // ==================== File Logs ====================

  async createFileLog(input: CreateFileLogInput): Promise<TerminalFileLogEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO terminal_file_logs (tenant_id, username, hostname, file_path, file_name, file_size, operation, timestamp, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId,
        input.username,
        input.hostname,
        input.filePath,
        input.fileName,
        input.fileSize,
        input.operation,
        input.timestamp,
        input.status || 'success',
        now,
      ]
    );
    return this.mapFileLogRow(result.rows[0]);
  }

  async findFileLogById(id: string, tenantId?: string): Promise<TerminalFileLogEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM terminal_file_logs WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapFileLogRow(result.rows[0]);
  }

  async findAllFileLogs(tenantId?: string, options?: { page?: number; pageSize?: number; operation?: string; status?: string }): Promise<{ entities: TerminalFileLogEntity[]; total: number }> {
    const tId = this.getTenantId(tenantId);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const offset = (page - 1) * pageSize;

    let countQuery = `SELECT COUNT(*) as count FROM terminal_file_logs WHERE tenant_id = $1`;
    let dataQuery = `SELECT * FROM terminal_file_logs WHERE tenant_id = $1`;
    const params: unknown[] = [tId];
    let paramIndex = 2;

    if (options?.operation) {
      countQuery += ` AND operation = $${paramIndex}`;
      dataQuery += ` AND operation = $${paramIndex}`;
      params.push(options.operation);
      paramIndex++;
    }
    if (options?.status) {
      countQuery += ` AND status = $${paramIndex}`;
      dataQuery += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    dataQuery += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageSize, offset);

    const result = await this.db.query(dataQuery, params);
    return {
      entities: result.rows.map(row => this.mapFileLogRow(row)),
      total,
    };
  }

  async getAuditStats(tenantId?: string): Promise<{
    totalConnectLogs: number;
    activeSessions: number;
    totalFileTransfers: number;
  }> {
    const tId = this.getTenantId(tenantId);

    const connectResult = await this.db.query(
      `SELECT COUNT(*) as count FROM terminal_connect_logs WHERE tenant_id = $1`,
      [tId]
    );
    const activeResult = await this.db.query(
      `SELECT COUNT(*) as count FROM terminal_connect_logs WHERE tenant_id = $1 AND status = 'active'`,
      [tId]
    );
    const fileResult = await this.db.query(
      `SELECT COUNT(*) as count FROM terminal_file_logs WHERE tenant_id = $1`,
      [tId]
    );

    return {
      totalConnectLogs: parseInt(connectResult.rows[0].count, 10),
      activeSessions: parseInt(activeResult.rows[0].count, 10),
      totalFileTransfers: parseInt(fileResult.rows[0].count, 10),
    };
  }

  // ==================== Row Mappers ====================

  private mapConnectLogRow(row: any): TerminalConnectLogEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      username: row.username,
      hostname: row.hostname,
      host_ip: row.host_ip,
      connect_time: new Date(row.connect_time),
      disconnect_time: row.disconnect_time ? new Date(row.disconnect_time) : null,
      duration: row.duration,
      status: row.status,
      client_ip: row.client_ip,
      created_at: new Date(row.created_at),
    };
  }

  private mapFileLogRow(row: any): TerminalFileLogEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      username: row.username,
      hostname: row.hostname,
      file_path: row.file_path,
      file_name: row.file_name,
      file_size: row.file_size,
      operation: row.operation,
      timestamp: new Date(row.timestamp),
      status: row.status,
      created_at: new Date(row.created_at),
    };
  }
}
