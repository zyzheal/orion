/**
 * VisorExecRepository — PostgreSQL data access for visor exec operations
 *
 * Covers 6 tables:
 * - visor_command_logs
 * - visor_command_log_details
 * - visor_templates
 * - visor_cron_jobs
 * - visor_cron_job_logs
 * - visor_upload_tasks
 */

import { getCurrentTenantId } from '../db/tenant-context-storage';
import { OrionError, ErrorCode } from '../errors';

// ==================== Entity Interfaces ====================

export interface CommandLogEntity {
  id: string;
  tenant_id: string;
  command: string;
  host_ids: string[];
  host_count: number;
  timeout: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  created_at: Date;
}

export interface CommandLogDetailEntity {
  id: string;
  tenant_id: string;
  command_id: string;
  hostname: string;
  output: string;
  error_output: string;
  exit_code: number;
  status: 'success' | 'failed' | 'running';
  created_at: Date;
}

export interface TemplateEntity {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  created_at: Date;
  updated_at: Date;
}

export interface CronJobEntity {
  id: string;
  tenant_id: string;
  name: string;
  command: string;
  host_ids: string[];
  hostnames: string[];
  cron_expression: string;
  enabled: boolean;
  last_run_at?: Date | null;
  next_run_at?: Date | null;
  created_at: Date;
}

export interface CronJobLogEntity {
  id: string;
  tenant_id: string;
  job_id: string;
  command_id: string;
  created_at: Date;
}

export interface UploadTaskEntity {
  id: string;
  tenant_id: string;
  file_name: string;
  file_size: number;
  host_ids: string[];
  hostnames: string[];
  target_path: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  progress: number;
  created_at: Date;
}

// ==================== Input Interfaces ====================

export interface CreateCommandLogInput {
  command: string;
  hostIds: string[];
  timeout?: number;
  status?: string;
  tenantId?: string;
}

export interface CreateCommandLogDetailInput {
  commandId: string;
  hostname: string;
  output?: string;
  errorOutput?: string;
  exitCode?: number;
  status?: string;
  tenantId?: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
  category?: string;
  tenantId?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  category?: string;
}

export interface CreateCronJobInput {
  name: string;
  command: string;
  hostIds: string[];
  hostnames: string[];
  cronExpression: string;
  enabled?: boolean;
  tenantId?: string;
}

export interface UpdateCronJobInput {
  name?: string;
  command?: string;
  hostIds?: string[];
  hostnames?: string[];
  cronExpression?: string;
  enabled?: boolean;
}

export interface CreateCronJobLogInput {
  jobId: string;
  commandId: string;
  tenantId?: string;
}

export interface CreateUploadTaskInput {
  fileName: string;
  fileSize: number;
  hostIds: string[];
  hostnames: string[];
  targetPath: string;
  status?: string;
  progress?: number;
  tenantId?: string;
}

export interface UpdateUploadTaskInput {
  status?: string;
  progress?: number;
}

// ==================== Repository ====================

export class VisorExecRepository {
  private db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.db = db;
  }

  private getTenantId(override?: string): string {
    return override || getCurrentTenantId();
  }

  // ==================== Command Logs ====================

  async createCommandLog(input: CreateCommandLogInput): Promise<CommandLogEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO visor_command_logs (tenant_id, command, host_ids, host_count, timeout, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tenantId,
        input.command,
        JSON.stringify(input.hostIds),
        input.hostIds.length,
        input.timeout || 30,
        input.status || 'success',
        now,
      ]
    );
    return this.mapCommandLogRow(result.rows[0]);
  }

  async findCommandLogById(id: string, tenantId?: string): Promise<CommandLogEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM visor_command_logs WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCommandLogRow(result.rows[0]);
  }

  async findAllCommandLogs(tenantId?: string, options?: { page?: number; pageSize?: number }): Promise<{ entities: CommandLogEntity[]; total: number }> {
    const tId = this.getTenantId(tenantId);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM visor_command_logs WHERE tenant_id = $1`,
      [tId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM visor_command_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tId, pageSize, offset]
    );
    return {
      entities: result.rows.map(row => this.mapCommandLogRow(row)),
      total,
    };
  }

  async createCommandLogDetails(details: CreateCommandLogDetailInput[], tenantId?: string): Promise<CommandLogDetailEntity[]> {
    const tId = this.getTenantId(tenantId);
    const now = new Date();
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    for (const detail of details) {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        tId,
        detail.commandId,
        detail.hostname,
        detail.output || '',
        detail.errorOutput || '',
        detail.exitCode || 0,
        detail.status || 'success',
      );
    }

    const query = `INSERT INTO visor_command_log_details (tenant_id, command_id, hostname, output, error_output, exit_code, status, created_at) VALUES ${placeholders.join(', ')} RETURNING *`;
    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapCommandLogDetailRow(row));
  }

  async findCommandLogDetailsByCommandId(commandId: string, tenantId?: string): Promise<CommandLogDetailEntity[]> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM visor_command_log_details WHERE command_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
      [commandId, tId]
    );
    return result.rows.map(row => this.mapCommandLogDetailRow(row));
  }

  // ==================== Templates ====================

  async createTemplate(input: CreateTemplateInput): Promise<TemplateEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO visor_templates (tenant_id, name, description, content, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.description || '',
        input.content,
        input.category || 'general',
        now,
        now,
      ]
    );
    return this.mapTemplateRow(result.rows[0]);
  }

  async findTemplateById(id: string, tenantId?: string): Promise<TemplateEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM visor_templates WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapTemplateRow(result.rows[0]);
  }

  async findAllTemplates(tenantId?: string, options?: { page?: number; pageSize?: number }): Promise<{ entities: TemplateEntity[]; total: number }> {
    const tId = this.getTenantId(tenantId);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM visor_templates WHERE tenant_id = $1`,
      [tId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM visor_templates WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
      [tId, pageSize, offset]
    );
    return {
      entities: result.rows.map(row => this.mapTemplateRow(row)),
      total,
    };
  }

  async updateTemplate(id: string, input: UpdateTemplateInput, tenantId?: string): Promise<TemplateEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const fields: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.content !== undefined) {
      fields.push(`content = $${paramIndex++}`);
      values.push(input.content);
    }
    if (input.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }

    values.push(id, tId);
    const result = await this.db.query(
      `UPDATE visor_templates SET ${fields.join(', ')} WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return undefined;
    return this.mapTemplateRow(result.rows[0]);
  }

  async deleteTemplate(id: string, tenantId?: string): Promise<boolean> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `DELETE FROM visor_templates WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Cron Jobs ====================

  async createCronJob(input: CreateCronJobInput): Promise<CronJobEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO visor_cron_jobs (tenant_id, name, command, host_ids, hostnames, cron_expression, enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        input.name,
        input.command,
        JSON.stringify(input.hostIds),
        JSON.stringify(input.hostnames),
        input.cronExpression,
        input.enabled ?? true,
        now,
      ]
    );
    return this.mapCronJobRow(result.rows[0]);
  }

  async findCronJobById(id: string, tenantId?: string): Promise<CronJobEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM visor_cron_jobs WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCronJobRow(result.rows[0]);
  }

  async findAllCronJobs(tenantId?: string, options?: { page?: number; pageSize?: number }): Promise<{ entities: CronJobEntity[]; total: number }> {
    const tId = this.getTenantId(tenantId);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM visor_cron_jobs WHERE tenant_id = $1`,
      [tId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM visor_cron_jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tId, pageSize, offset]
    );
    return {
      entities: result.rows.map(row => this.mapCronJobRow(row)),
      total,
    };
  }

  async updateCronJob(id: string, input: UpdateCronJobInput, tenantId?: string): Promise<CronJobEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.command !== undefined) {
      fields.push(`command = $${paramIndex++}`);
      values.push(input.command);
    }
    if (input.hostIds !== undefined) {
      fields.push(`host_ids = $${paramIndex++}`);
      values.push(JSON.stringify(input.hostIds));
    }
    if (input.hostnames !== undefined) {
      fields.push(`hostnames = $${paramIndex++}`);
      values.push(JSON.stringify(input.hostnames));
    }
    if (input.cronExpression !== undefined) {
      fields.push(`cron_expression = $${paramIndex++}`);
      values.push(input.cronExpression);
    }
    if (input.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(input.enabled);
    }

    if (fields.length === 0) {
      return this.findCronJobById(id, tId);
    }

    values.push(id, tId);
    const result = await this.db.query(
      `UPDATE visor_cron_jobs SET ${fields.join(', ')} WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCronJobRow(result.rows[0]);
  }

  async deleteCronJob(id: string, tenantId?: string): Promise<boolean> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `DELETE FROM visor_cron_jobs WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async toggleCronJob(id: string, enabled: boolean, tenantId?: string): Promise<CronJobEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `UPDATE visor_cron_jobs SET enabled = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [enabled, id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCronJobRow(result.rows[0]);
  }

  async updateCronJobLastRun(id: string, lastRunAt: Date, tenantId?: string): Promise<CronJobEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `UPDATE visor_cron_jobs SET last_run_at = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [lastRunAt, id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapCronJobRow(result.rows[0]);
  }

  // ==================== Cron Job Logs ====================

  async createCronJobLog(input: CreateCronJobLogInput): Promise<CronJobLogEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO visor_cron_job_logs (tenant_id, job_id, command_id, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, input.jobId, input.commandId, now]
    );
    return this.mapCronJobLogRow(result.rows[0]);
  }

  async findCronJobLogsByJobId(jobId: string, tenantId?: string, options?: { page?: number; pageSize?: number }): Promise<{ entities: CronJobLogEntity[]; total: number }> {
    const tId = this.getTenantId(tenantId);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM visor_cron_job_logs WHERE job_id = $1 AND tenant_id = $2`,
      [jobId, tId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM visor_cron_job_logs WHERE job_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [jobId, tId, pageSize, offset]
    );
    return {
      entities: result.rows.map(row => this.mapCronJobLogRow(row)),
      total,
    };
  }

  // ==================== Upload Tasks ====================

  async createUploadTask(input: CreateUploadTaskInput): Promise<UploadTaskEntity> {
    const tenantId = this.getTenantId(input.tenantId);
    const now = new Date();
    const result = await this.db.query(
      `INSERT INTO visor_upload_tasks (tenant_id, file_name, file_size, host_ids, hostnames, target_path, status, progress, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        input.fileName,
        input.fileSize,
        JSON.stringify(input.hostIds),
        JSON.stringify(input.hostnames),
        input.targetPath,
        input.status || 'success',
        input.progress || 100,
        now,
      ]
    );
    return this.mapUploadTaskRow(result.rows[0]);
  }

  async findUploadTaskById(id: string, tenantId?: string): Promise<UploadTaskEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const result = await this.db.query(
      `SELECT * FROM visor_upload_tasks WHERE id = $1 AND tenant_id = $2`,
      [id, tId]
    );
    if (result.rows.length === 0) return undefined;
    return this.mapUploadTaskRow(result.rows[0]);
  }

  async findAllUploadTasks(tenantId?: string, options?: { page?: number; pageSize?: number }): Promise<{ entities: UploadTaskEntity[]; total: number }> {
    const tId = this.getTenantId(tenantId);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.query(
      `SELECT COUNT(*) as count FROM visor_upload_tasks WHERE tenant_id = $1`,
      [tId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.db.query(
      `SELECT * FROM visor_upload_tasks WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tId, pageSize, offset]
    );
    return {
      entities: result.rows.map(row => this.mapUploadTaskRow(row)),
      total,
    };
  }

  async updateUploadTask(id: string, input: UpdateUploadTaskInput, tenantId?: string): Promise<UploadTaskEntity | undefined> {
    const tId = this.getTenantId(tenantId);
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.progress !== undefined) {
      fields.push(`progress = $${paramIndex++}`);
      values.push(input.progress);
    }

    if (fields.length === 0) {
      return this.findUploadTaskById(id, tId);
    }

    values.push(id, tId);
    const result = await this.db.query(
      `UPDATE visor_upload_tasks SET ${fields.join(', ')} WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex++} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return undefined;
    return this.mapUploadTaskRow(result.rows[0]);
  }

  // ==================== Row Mappers ====================

  private mapCommandLogRow(row: any): CommandLogEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      command: row.command,
      host_ids: typeof row.host_ids === 'string' ? JSON.parse(row.host_ids) : (row.host_ids || []),
      host_count: parseInt(row.host_count, 10) || 0,
      timeout: parseInt(row.timeout, 10) || 30,
      status: row.status || 'success',
      created_at: new Date(row.created_at),
    };
  }

  private mapCommandLogDetailRow(row: any): CommandLogDetailEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      command_id: row.command_id,
      hostname: row.hostname,
      output: row.output || '',
      error_output: row.error_output || '',
      exit_code: parseInt(row.exit_code, 10) || 0,
      status: row.status || 'success',
      created_at: new Date(row.created_at),
    };
  }

  private mapTemplateRow(row: any): TemplateEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description || '',
      content: row.content,
      category: row.category || 'general',
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapCronJobRow(row: any): CronJobEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      command: row.command,
      host_ids: typeof row.host_ids === 'string' ? JSON.parse(row.host_ids) : (row.host_ids || []),
      hostnames: typeof row.hostnames === 'string' ? JSON.parse(row.hostnames) : (row.hostnames || []),
      cron_expression: row.cron_expression,
      enabled: row.enabled ?? true,
      last_run_at: row.last_run_at ? new Date(row.last_run_at) : null,
      next_run_at: row.next_run_at ? new Date(row.next_run_at) : null,
      created_at: new Date(row.created_at),
    };
  }

  private mapCronJobLogRow(row: any): CronJobLogEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      job_id: row.job_id,
      command_id: row.command_id,
      created_at: new Date(row.created_at),
    };
  }

  private mapUploadTaskRow(row: any): UploadTaskEntity {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      file_name: row.file_name,
      file_size: parseInt(row.file_size, 10) || 0,
      host_ids: typeof row.host_ids === 'string' ? JSON.parse(row.host_ids) : (row.host_ids || []),
      hostnames: typeof row.hostnames === 'string' ? JSON.parse(row.hostnames) : (row.hostnames || []),
      target_path: row.target_path,
      status: row.status || 'pending',
      progress: parseInt(row.progress, 10) || 0,
      created_at: new Date(row.created_at),
    };
  }
}
