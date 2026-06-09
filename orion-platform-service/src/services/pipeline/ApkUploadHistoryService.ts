/**
 * APK Upload History Service - APK 上传历史记录服务
 *
 * 负责记录和管理 APK 上传到各应用市场的历史记录。
 * PostgreSQL is the primary data source. In-memory Map acts as a read-through cache.
 */

import { ApkUploadRepository } from '../../repositories/ApkUploadRepository';

export interface ApkUploadRecord {
  id: string;
  tenantId: string;
  pipelineRunId?: string;
  pipelineId?: string;
  pipelineName?: string;
  market: string;
  packageName: string;
  versionName?: string;
  versionCode?: number;
  apkPath: string;
  status: 'pending' | 'uploading' | 'submitted' | 'published' | 'failed';
  uploadUrl?: string;
  uploadId?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  progress?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApkUploadRecordCreateInput {
  tenantId: string;
  pipelineRunId?: string;
  pipelineId?: string;
  pipelineName?: string;
  market: string;
  packageName: string;
  versionName?: string;
  versionCode?: number;
  apkPath: string;
  status: ApkUploadRecord['status'];
  uploadUrl?: string;
  uploadId?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  progress?: number;
}

export class ApkUploadHistoryService {
  private records: Map<string, ApkUploadRecord> = new Map();
  private repository: ApkUploadRepository;

  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    this.repository = new ApkUploadRepository(db);
  }

  /**
   * 创建上传记录
   * Persists to DB first, then updates cache.
   */
  async create(input: ApkUploadRecordCreateInput): Promise<ApkUploadRecord> {
    const id = `apk-upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Persist to DB first (primary store)
    const entity = await this.repository.create({
      id,
      tenantId: input.tenantId,
      pipelineRunId: input.pipelineRunId || null,
      pipelineId: input.pipelineId || null,
      pipelineName: input.pipelineName || null,
      market: input.market,
      packageName: input.packageName,
      versionName: input.versionName || null,
      versionCode: input.versionCode || null,
      apkPath: input.apkPath,
      status: input.status,
      uploadUrl: input.uploadUrl || null,
      uploadId: input.uploadId || null,
      error: input.error || null,
      stdout: input.stdout || null,
      stderr: input.stderr || null,
      durationMs: input.durationMs || null,
      progress: input.progress || null,
    });

    // Map entity to record for cache and return value
    const record: ApkUploadRecord = {
      id: entity.id,
      tenantId: entity.tenantId,
      pipelineRunId: entity.pipelineRunId || undefined,
      pipelineId: entity.pipelineId || undefined,
      pipelineName: entity.pipelineName || undefined,
      market: entity.market,
      packageName: entity.packageName,
      versionName: entity.versionName || undefined,
      versionCode: entity.versionCode || undefined,
      apkPath: entity.apkPath,
      status: entity.status as ApkUploadRecord['status'],
      uploadUrl: entity.uploadUrl || undefined,
      uploadId: entity.uploadId || undefined,
      error: entity.error || undefined,
      stdout: entity.stdout || undefined,
      stderr: entity.stderr || undefined,
      durationMs: entity.durationMs || undefined,
      progress: entity.progress || undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };

    this.records.set(record.id, record);
    return record;
  }

  /**
   * 更新上传记录
   * Persists to DB first, then updates cache.
   */
  async update(id: string, updates: Partial<ApkUploadRecord>): Promise<ApkUploadRecord | null> {
    // Check existence via DB
    const existing = await this.repository.findById(id);
    if (!existing) return null;

    // Build DB-compatible update payload (camelCase keys for BaseRepository)
    const dbUpdates: Record<string, unknown> = {};
    if (updates.tenantId !== undefined) dbUpdates.tenantId = updates.tenantId;
    if (updates.pipelineRunId !== undefined) dbUpdates.pipelineRunId = updates.pipelineRunId;
    if (updates.pipelineId !== undefined) dbUpdates.pipelineId = updates.pipelineId;
    if (updates.pipelineName !== undefined) dbUpdates.pipelineName = updates.pipelineName;
    if (updates.market !== undefined) dbUpdates.market = updates.market;
    if (updates.packageName !== undefined) dbUpdates.packageName = updates.packageName;
    if (updates.versionName !== undefined) dbUpdates.versionName = updates.versionName;
    if (updates.versionCode !== undefined) dbUpdates.versionCode = updates.versionCode;
    if (updates.apkPath !== undefined) dbUpdates.apkPath = updates.apkPath;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.uploadUrl !== undefined) dbUpdates.uploadUrl = updates.uploadUrl;
    if (updates.uploadId !== undefined) dbUpdates.uploadId = updates.uploadId;
    if (updates.error !== undefined) dbUpdates.error = updates.error;
    if (updates.stdout !== undefined) dbUpdates.stdout = updates.stdout;
    if (updates.stderr !== undefined) dbUpdates.stderr = updates.stderr;
    if (updates.durationMs !== undefined) dbUpdates.durationMs = updates.durationMs;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;

    // Persist to DB
    const entity = await this.repository.update(id, dbUpdates);

    const record: ApkUploadRecord = {
      id: entity.id,
      tenantId: entity.tenantId,
      pipelineRunId: entity.pipelineRunId || undefined,
      pipelineId: entity.pipelineId || undefined,
      pipelineName: entity.pipelineName || undefined,
      market: entity.market,
      packageName: entity.packageName,
      versionName: entity.versionName || undefined,
      versionCode: entity.versionCode || undefined,
      apkPath: entity.apkPath,
      status: entity.status as ApkUploadRecord['status'],
      uploadUrl: entity.uploadUrl || undefined,
      uploadId: entity.uploadId || undefined,
      error: entity.error || undefined,
      stdout: entity.stdout || undefined,
      stderr: entity.stderr || undefined,
      durationMs: entity.durationMs || undefined,
      progress: entity.progress || undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };

    this.records.set(id, record);
    return record;
  }

  /**
   * 按 ID 查询（仅内部使用，不验证租户）
   * Cache-first with DB fallback.
   */
  async findById(id: string): Promise<ApkUploadRecord | null> {
    const cached = this.records.get(id);
    if (cached) return cached;

    // DB fallback
    const entity = await this.repository.findById(id);
    if (entity) {
      const record = this.entityToRecord(entity);
      this.records.set(id, record);
      return record;
    }
    return null;
  }

  /**
   * 按 ID 和租户查询（安全的租户隔离查询）
   * Uses DB for tenant-secure lookup.
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<ApkUploadRecord | null> {
    // Check cache first (fast path with tenant verification)
    const cached = this.records.get(id);
    if (cached && cached.tenantId === tenantId) return cached;

    // DB fallback with tenant isolation
    const entity = await this.repository.findByTenantAndId(tenantId, id);
    if (entity) {
      const record = this.entityToRecord(entity);
      this.records.set(id, record);
      return record;
    }
    return null;
  }

  /**
   * 按租户查询历史记录
   * Queries DB (source of truth).
   */
  async findByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      market?: string;
      status?: ApkUploadRecord['status'];
    }
  ): Promise<ApkUploadRecord[]> {
    const entities = await this.repository.findByTenant(tenantId, {
      market: options?.market,
      status: options?.status,
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    });

    return entities.map(entity => {
      const record = this.entityToRecord(entity);
      this.records.set(record.id, record);
      return record;
    });
  }

  /**
   * 按 Pipeline Run 查询
   * Queries DB (source of truth).
   */
  async findByPipelineRun(pipelineRunId: string): Promise<ApkUploadRecord[]> {
    const entities = await this.repository.findByPipelineRun(pipelineRunId);
    return entities.map(entity => {
      const record = this.entityToRecord(entity);
      this.records.set(record.id, record);
      return record;
    });
  }

  /**
   * 统计租户上传记录
   * Queries DB for accurate count.
   */
  async countByTenant(
    tenantId: string,
    filters?: { market?: string; status?: ApkUploadRecord['status'] }
  ): Promise<number> {
    return this.repository.countByTenant(tenantId, filters);
  }

  /**
   * 获取最近的失败记录
   * Queries DB (source of truth).
   */
  async getRecentFailures(tenantId: string, limit: number = 10): Promise<ApkUploadRecord[]> {
    const entities = await this.repository.findRecentFailures(tenantId, limit);
    return entities.map(entity => {
      const record = this.entityToRecord(entity);
      this.records.set(record.id, record);
      return record;
    });
  }

  /**
   * 获取上传统计信息（按状态分组）
   * Queries DB for accurate stats.
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    published: number;
    failed: number;
    uploading: number;
    pending: number;
    submitted: number;
  }> {
    return this.repository.getStats(tenantId);
  }

  /**
   * Convert ApkUploadEntity to ApkUploadRecord.
   */
  private entityToRecord(entity: import('../../repositories/ApkUploadRepository').ApkUploadEntity): ApkUploadRecord {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      pipelineRunId: entity.pipelineRunId || undefined,
      pipelineId: entity.pipelineId || undefined,
      pipelineName: entity.pipelineName || undefined,
      market: entity.market,
      packageName: entity.packageName,
      versionName: entity.versionName || undefined,
      versionCode: entity.versionCode || undefined,
      apkPath: entity.apkPath,
      status: entity.status as ApkUploadRecord['status'],
      uploadUrl: entity.uploadUrl || undefined,
      uploadId: entity.uploadId || undefined,
      error: entity.error || undefined,
      stdout: entity.stdout || undefined,
      stderr: entity.stderr || undefined,
      durationMs: entity.durationMs || undefined,
      progress: entity.progress || undefined,
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }
}

export default ApkUploadHistoryService;