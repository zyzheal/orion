/**
 * APK Upload History Service - APK 上传历史记录服务
 *
 * 负责记录和管理 APK 上传到各应用市场的历史记录
 */

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

  /**
   * 创建上传记录
   */
  async create(input: ApkUploadRecordCreateInput): Promise<ApkUploadRecord> {
    const record: ApkUploadRecord = {
      id: `apk-upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.records.set(record.id, record);
    return record;
  }

  /**
   * 更新上传记录
   */
  async update(id: string, updates: Partial<ApkUploadRecord>): Promise<ApkUploadRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;

    const updated: ApkUploadRecord = {
      ...record,
      ...updates,
      updatedAt: new Date(),
    };

    this.records.set(id, updated);
    return updated;
  }

  /**
   * 按 ID 查询（仅内部使用，不验证租户）
   */
  async findById(id: string): Promise<ApkUploadRecord | null> {
    return this.records.get(id) || null;
  }

  /**
   * 按 ID 和租户查询（安全的租户隔离查询）
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<ApkUploadRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;
    // Verify tenant matches for security
    if (record.tenantId !== tenantId) {
      return null; // Return null instead of throwing to prevent enumeration attacks
    }
    return record;
  }

  /**
   * 按租户查询历史记录
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
    let records = Array.from(this.records.values()).filter(
      (r) => r.tenantId === tenantId
    );

    if (options?.market) {
      records = records.filter((r) => r.market === options.market);
    }

    if (options?.status) {
      records = records.filter((r) => r.status === options.status);
    }

    // Sort by createdAt descending
    records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    return records.slice(offset, offset + limit);
  }

  /**
   * 按 Pipeline Run 查询
   */
  async findByPipelineRun(pipelineRunId: string): Promise<ApkUploadRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.pipelineRunId === pipelineRunId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 统计租户上传记录
   */
  async countByTenant(
    tenantId: string,
    filters?: { market?: string; status?: ApkUploadRecord['status'] }
  ): Promise<number> {
    let records = Array.from(this.records.values()).filter(
      (r) => r.tenantId === tenantId
    );

    if (filters?.market) {
      records = records.filter((r) => r.market === filters.market);
    }

    if (filters?.status) {
      records = records.filter((r) => r.status === filters.status);
    }

    return records.length;
  }

  /**
   * 获取最近的失败记录
   */
  async getRecentFailures(tenantId: string, limit: number = 10): Promise<ApkUploadRecord[]> {
    return Array.from(this.records.values())
      .filter((r) => r.tenantId === tenantId && r.status === 'failed')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * 获取上传统计信息（按状态分组）
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    published: number;
    failed: number;
    uploading: number;
    pending: number;
    submitted: number;
  }> {
    const records = Array.from(this.records.values()).filter(
      (r) => r.tenantId === tenantId
    );

    const stats = {
      total: records.length,
      published: 0,
      failed: 0,
      uploading: 0,
      pending: 0,
      submitted: 0,
    };

    for (const record of records) {
      if (record.status in stats) {
        (stats as any)[record.status]++;
      }
    }

    return stats;
  }
}

export default ApkUploadHistoryService;