/**
 * APK Upload History Service - APK 上传历史记录服务
 *
 * 负责记录和管理 APK 上传到各应用市场的历史记录。
 *
 * 持久化: PostgreSQL (migration 370) + 内存优雅降级
 * DB 不可用时自动降级到内存 Map，保证服务可用性。
 *
 * 字段映射: 外部接口保留原始字段名 (market, packageName, pipelineRunId...)
 *           内部映射到 apk_upload_history 表 (app_name, metadata 等)
 */

type DatabasePool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

/**
 * Raw DB row mapped from apk_upload_history table.
 */
interface ApkUploadRow {
  id: string;
  tenant_id: string;
  app_name: string;
  version_code: number;
  version_name: string | null;
  file_size: number | null;
  upload_by: string | null;
  upload_at: Date | string;
  status: string;
  metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

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
  status: 'pending' | 'uploading' | 'submitted' | 'published' | 'failed' | 'uploaded';
  uploadUrl?: string;
  uploadId?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  progress?: number;
  fileSize?: number;
  uploadBy?: string;
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
  status?: ApkUploadRecord['status'];
  uploadUrl?: string;
  uploadId?: string;
  error?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  progress?: number;
  fileSize?: number;
  uploadBy?: string;
  metadata?: Record<string, unknown>;
}

export class ApkUploadHistoryService {
  /**
   * In-memory fallback store.
   * Populated on DB hits and serves as the sole storage when DB is unavailable.
   */
  private memoryStore: Map<string, ApkUploadRecord> = new Map();

  private db: DatabasePool | null;
  private dbReady: boolean;

  /**
   * @param db  Optional PostgreSQL connection pool.
   *            If omitted or DB probe fails, service runs entirely in-memory.
   */
  constructor(db?: DatabasePool) {
    this.db = db || null;
    this.dbReady = false;

    if (this.db) {
      this._probeDb().catch(() => {
        // Table may not exist yet - silently fall back to memory
      });
    }
  }

  /* ----------------------------------------------------------- */
  /*  Internal helpers                                             */
  /* ----------------------------------------------------------- */

  /** Probe whether the PostgreSQL table is reachable. */
  private async _probeDb(): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.query('SELECT 1 FROM apk_upload_history LIMIT 0');
      this.dbReady = true;
    } catch {
      this.dbReady = false;
    }
  }

  /** Mark DB unavailable - triggers in-memory fallback on subsequent calls. */
  private _markDbUnavailable(): void {
    this.dbReady = false;
  }

  /** Parse a DB date value to a JS Date object. */
  private _toDate(value: Date | string | undefined | null): Date {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /** Normalize a raw status string to a known enum value. */
  private _normalizeStatus(raw: string): ApkUploadRecord['status'] {
    const valid: ApkUploadRecord['status'][] = [
      'pending', 'uploading', 'submitted', 'published', 'failed', 'uploaded',
    ];
    return valid.includes(raw as any) ? (raw as ApkUploadRecord['status']) : 'uploaded';
  }

  /** Serialize metadata to a DB-safe value. */
  private _serializeMetadata(meta: unknown): string | Record<string, unknown> {
    if (typeof meta === 'string') return meta;
    if (typeof meta === 'object' && meta !== null) return meta as Record<string, unknown>;
    return {};
  }

  /**
   * Convert a raw DB row into the public record shape.
   * Maps internal fields back to external API shape.
   */
  private _rowToRecord(row: ApkUploadRow): ApkUploadRecord {
    const metaRaw = row.metadata;
    const metadata = typeof metaRaw === 'string'
      ? ((metaRaw === '' || metaRaw === 'null') ? {} : JSON.parse(metaRaw))
      : (metaRaw as Record<string, unknown>) || {};

    return {
      id: row.id,
      tenantId: row.tenant_id,
      // Map app_name -> packageName (backward compat)
      packageName: row.app_name,
      // Derive market from metadata or default to app_name
      market: (metadata.market as string) || row.app_name,
      // Map version_code -> versionCode
      versionCode: row.version_code,
      versionName: row.version_name || undefined,
      fileSize: row.file_size ?? undefined,
      uploadBy: row.upload_by || undefined,
      // Store extra metadata fields for backward compat
      pipelineRunId: (metadata.pipelineRunId as string) || undefined,
      pipelineId: (metadata.pipelineId as string) || undefined,
      pipelineName: (metadata.pipelineName as string) || undefined,
      apkPath: (metadata.apkPath as string) || `/apps/${row.app_name}/v${row.version_code}`,
      status: this._normalizeStatus(row.status),
      uploadUrl: (metadata.uploadUrl as string) || undefined,
      uploadId: (metadata.uploadId as string) || undefined,
      error: (metadata.error as string) || undefined,
      stdout: (metadata.stdout as string) || undefined,
      stderr: (metadata.stderr as string) || undefined,
      durationMs: (metadata.durationMs as number) || undefined,
      progress: (metadata.progress as number) || undefined,
      createdAt: this._toDate(row.created_at),
      updatedAt: this._toDate(row.updated_at),
    };
  }

  /**
   * Flatten an ApkUploadRecord into DB insert fields for apk_upload_history table.
   * External fields (market, packageName, pipelineRunId...) get serialized into metadata.
   */
  private _recordToDbValues(record: Partial<ApkUploadRecord> & { id: string }): {
    columns: string[];
    values: unknown[];
  } {
    const meta: Record<string, unknown> = {
      market: record.market,
      pipelineRunId: record.pipelineRunId,
      pipelineId: record.pipelineId,
      pipelineName: record.pipelineName,
      apkPath: record.apkPath,
      uploadUrl: record.uploadUrl,
      uploadId: record.uploadId,
      error: record.error,
      stdout: record.stdout,
      stderr: record.stderr,
      durationMs: record.durationMs,
      progress: record.progress,
    };

    const values: unknown[] = [
      record.id,
      record.tenantId,
      record.packageName || record.market || 'unknown',   // app_name
      record.versionCode || 0,                              // version_code
      record.versionName || null,                           // version_name
      record.fileSize ?? null,                              // file_size
      record.uploadBy || null,                              // upload_by
      record.status || 'uploaded',                          // status
      JSON.stringify(meta),                                  // metadata
    ];

    const columns = [
      'id', 'tenant_id', 'app_name', 'version_code',
      'version_name', 'file_size', 'upload_by', 'status', 'metadata',
    ];

    return { columns, values };
  }

  /**
   * Flatten partial update into DB columns and params.
   */
  private _updateToDbValues(id: string, updates: Partial<ApkUploadRecord>): {
    setClause: string;
    params: unknown[];
  } {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    // Direct column mappings
    if (updates.packageName !== undefined) {
      params.push(updates.packageName);
      setClauses.push(`app_name = $${idx++}`);
    }
    if (updates.versionName !== undefined) {
      params.push(updates.versionName);
      setClauses.push(`version_name = $${idx++}`);
    }
    if (updates.versionCode !== undefined) {
      params.push(updates.versionCode);
      setClauses.push(`version_code = $${idx++}`);
    }
    if (updates.fileSize !== undefined) {
      params.push(updates.fileSize);
      setClauses.push(`file_size = $${idx++}`);
    }
    if (updates.uploadBy !== undefined) {
      params.push(updates.uploadBy);
      setClauses.push(`upload_by = $${idx++}`);
    }
    if (updates.status !== undefined) {
      params.push(updates.status);
      setClauses.push(`status = $${idx++}`);
    }

    // Build metadata from changed fields
    const metaChanges: Record<string, unknown> = {};
    const metaFieldKeys: (keyof ApkUploadRecord)[] = [
      'market', 'pipelineRunId', 'pipelineId', 'pipelineName',
      'apkPath', 'uploadUrl', 'uploadId', 'error',
      'stdout', 'stderr', 'durationMs', 'progress',
    ];
    for (const key of metaFieldKeys) {
      if ((updates as any)[key] !== undefined) {
        metaChanges[key] = (updates as any)[key];
      }
    }

    if (Object.keys(metaChanges).length > 0) {
      params.push(JSON.stringify(metaChanges));
      setClauses.push(`metadata = $${idx++}`);
    }

    // Always add updated_at
    params.push(new Date());
    setClauses.push(`updated_at = $${idx++}`);

    // Add WHERE id param
    params.push(id);

    return {
      setClause: setClauses.join(', '),
      params,
    };
  }

  /* ----------------------------------------------------------- */
  /*  Public API                                                  */
  /* ----------------------------------------------------------- */

  /**
   * Create an APK upload history record.
   *
   * Writes to PostgreSQL first; on failure writes to memory only.
   * Always keeps a copy in the memory cache.
   */
  async create(input: ApkUploadRecordCreateInput): Promise<ApkUploadRecord> {
    const id = `apk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date();

    const record: ApkUploadRecord = {
      id,
      tenantId: input.tenantId,
      packageName: input.packageName,
      market: input.market,
      versionCode: input.versionCode,
      versionName: input.versionName,
      apkPath: input.apkPath,
      status: input.status || 'uploaded',
      pipelineRunId: input.pipelineRunId,
      pipelineId: input.pipelineId,
      pipelineName: input.pipelineName,
      uploadUrl: input.uploadUrl,
      uploadId: input.uploadId,
      error: input.error,
      stdout: input.stdout,
      stderr: input.stderr,
      durationMs: input.durationMs,
      progress: input.progress,
      fileSize: input.fileSize,
      uploadBy: input.uploadBy,
      createdAt: now,
      updatedAt: now,
    };

    // Attempt DB write
    if (this.dbReady) {
      try {
        const { columns, values } = this._recordToDbValues(record);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        await this.db.query(
          `INSERT INTO apk_upload_history (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values,
        );
        // Keep cache warm
        this.memoryStore.set(id, record);
        return record;
      } catch {
        this._markDbUnavailable();
      }
    }

    // Graceful degradation: in-memory only
    this.memoryStore.set(id, record);
    return record;
  }

  /**
   * Update an existing record by ID.
   *
   * Attempts DB update; falls back to memory-only on failure.
   */
  async update(id: string, updates: Partial<ApkUploadRecord>): Promise<ApkUploadRecord | null> {
    // Locate existing record first (via cache or DB)
    const existing = await this.findById(id);
    if (!existing) return null;

    // Merge updates
    const updated: ApkUploadRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    // Normalize status field if being updated
    if (updates.status !== undefined) {
      (updated as any).status = this._normalizeStatus(updates.status);
    }

    // Attempt DB update
    if (this.dbReady) {
      try {
        const { setClause, params } = this._updateToDbValues(id, updates);
        if (setClause.length > 0) {
          await this.db.query(
            `UPDATE apk_upload_history SET ${setClause} WHERE id = $${params.length} RETURNING *`,
            params,
          );
        }
      } catch {
        this._markDbUnavailable();
      }
    }

    // Always keep memory store consistent
    this.memoryStore.set(id, updated);
    return updated;
  }

  /**
   * Find a record by ID.
   *
   * Cache-first: checks memory store before querying DB.
   * Falls back to memory on DB failure.
   */
  async findById(id: string): Promise<ApkUploadRecord | null> {
    // Fast path: memory cache
    const cached = this.memoryStore.get(id);
    if (cached) return cached;

    // DB query
    if (this.dbReady) {
      try {
        const result = await this.db.query(
          `SELECT * FROM apk_upload_history WHERE id = $1`,
          [id],
        );
        if (result.rows.length > 0) {
          const row = result.rows[0] as ApkUploadRow | null;
          if (!row) return null;
          const record = this._rowToRecord(row);
          this.memoryStore.set(id, record);
          return record;
        }
        return null;
      } catch {
        this._markDbUnavailable();
      }
    }

    return null;
  }

  /**
   * Find a record by ID with tenant isolation.
   * Prevents cross-tenant data leakage.
   */
  async findByIdAndTenant(id: string, tenantId: string): Promise<ApkUploadRecord | null> {
    // Check cache first with tenant verification
    const cached = this.memoryStore.get(id);
    if (cached && cached.tenantId === tenantId) return cached;

    if (this.dbReady) {
      try {
        const result = await this.db.query(
          `SELECT * FROM apk_upload_history WHERE id = $1 AND tenant_id = $2`,
          [id, tenantId],
        );
        if (result.rows.length > 0) {
          const row = result.rows[0] as ApkUploadRow | null;
          if (!row) return null;
          const record = this._rowToRecord(row);
          this.memoryStore.set(id, record);
          return record;
        }
        return null;
      } catch {
        this._markDbUnavailable();
      }
    }

    return null;
  }

  /**
   * Query upload records by tenant with optional filters and pagination.
   */
  async findByTenant(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      market?: string;
      status?: ApkUploadRecord['status'];
    },
  ): Promise<ApkUploadRecord[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    if (this.dbReady) {
      try {
        let query = `SELECT * FROM apk_upload_history WHERE tenant_id = $1`;
        const params: unknown[] = [tenantId];
        let paramIdx = 2;

        if (options?.market) {
          query += ` AND app_name = $${paramIdx++}`;
          params.push(options.market);
        }
        if (options?.status) {
          query += ` AND status = $${paramIdx++}`;
          params.push(options.status);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
        params.push(limit, offset);

        const result = await this.db.query(query, params);
        const records = result.rows.map((row: any) => this._rowToRecord(row as ApkUploadRow));

        // Warm memory cache
        for (const record of records) {
          this.memoryStore.set(record.id, record);
        }

        return records;
      } catch {
        this._markDbUnavailable();
      }
    }

    // Fallback: filter in-memory store
    return this._filterMemory(tenantId, options, limit, offset);
  }

  /**
   * Query records by pipeline run ID.
   */
  async findByPipelineRun(pipelineRunId: string): Promise<ApkUploadRecord[]> {
    // DB query: search in metadata JSONB
    if (this.dbReady) {
      try {
        const result = await this.db.query(
          `SELECT * FROM apk_upload_history
           WHERE metadata->>'pipelineRunId' = $1
           ORDER BY created_at DESC`,
          [pipelineRunId],
        );
        return result.rows.map((row: any) => this._rowToRecord(row as ApkUploadRow));
      } catch {
        this._markDbUnavailable();
      }
    }

    // Fallback: filter memory
    return Array.from(this.memoryStore.values())
      .filter(r => r.pipelineRunId === pipelineRunId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Count records for a tenant with optional filters.
   */
  async countByTenant(
    tenantId: string,
    filters?: { market?: string; status?: ApkUploadRecord['status'] },
  ): Promise<number> {
    if (this.dbReady) {
      try {
        let query = `SELECT COUNT(*) as count FROM apk_upload_history WHERE tenant_id = $1`;
        const params: unknown[] = [tenantId];
        let paramIdx = 2;

        if (filters?.market) {
          query += ` AND app_name = $${paramIdx++}`;
          params.push(filters.market);
        }
        if (filters?.status) {
          query += ` AND status = $${paramIdx++}`;
          params.push(filters.status);
        }

        const result = await this.db.query(query, params);
        return parseInt(result.rows[0].count, 10);
      } catch {
        this._markDbUnavailable();
      }
    }

    // Fallback: count in memory
    const records = Array.from(this.memoryStore.values()).filter(r => r.tenantId === tenantId);
    if (filters?.market) {
      return records.filter(r => r.market === filters.market).length;
    }
    if (filters?.status) {
      return records.filter(r => r.status === filters.status).length;
    }
    return records.length;
  }

  /**
   * Get recent upload failures for a tenant.
   */
  async getRecentFailures(tenantId: string, limit: number = 10): Promise<ApkUploadRecord[]> {
    if (this.dbReady) {
      try {
        const result = await this.db.query(
          `SELECT * FROM apk_upload_history
           WHERE tenant_id = $1 AND status = 'failed'
           ORDER BY created_at DESC LIMIT $2`,
          [tenantId, limit],
        );
        return result.rows.map((row: any) => this._rowToRecord(row as ApkUploadRow));
      } catch {
        this._markDbUnavailable();
      }
    }

    // Fallback: filter memory
    return Array.from(this.memoryStore.values())
      .filter(r => r.tenantId === tenantId && r.status === 'failed')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get upload statistics grouped by status for a tenant.
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    published: number;
    failed: number;
    uploading: number;
    pending: number;
    submitted: number;
  }> {
    if (this.dbReady) {
      try {
        const result = await this.db.query(
          `SELECT status, COUNT(*) as count FROM apk_upload_history
           WHERE tenant_id = $1 GROUP BY status`,
          [tenantId],
        );

        const stats = { total: 0, published: 0, failed: 0, uploading: 0, pending: 0, submitted: 0 };
        for (const row of result.rows) {
          const count = parseInt(row.count, 10);
          stats.total += count;
          switch (row.status) {
            case 'published':  stats.published = count; break;
            case 'failed':     stats.failed = count; break;
            case 'uploading':  stats.uploading = count; break;
            case 'pending':    stats.pending = count; break;
            case 'submitted':  stats.submitted = count; break;
          }
        }
        return stats;
      } catch {
        this._markDbUnavailable();
      }
    }

    // Fallback: compute from memory
    const records = Array.from(this.memoryStore.values()).filter(r => r.tenantId === tenantId);
    const stats = { total: 0, published: 0, failed: 0, uploading: 0, pending: 0, submitted: 0 };
    stats.total = records.length;
    for (const r of records) {
      if (r.status === 'published')  stats.published++;
      if (r.status === 'failed')     stats.failed++;
      if (r.status === 'uploading')  stats.uploading++;
      if (r.status === 'pending')    stats.pending++;
      if (r.status === 'submitted')  stats.submitted++;
    }
    return stats;
  }

  /**
   * Clear the in-memory cache only. Does not affect DB data.
   */
  clearCache(): void {
    this.memoryStore.clear();
  }

  /* ----------------------------------------------------------- */
  /*  Private helpers                                             */
  /* ----------------------------------------------------------- */

  /** Apply in-memory filtering for fallback path. */
  private _filterMemory(
    tenantId: string,
    options: { market?: string; status?: ApkUploadRecord['status']; limit?: number; offset?: number } | undefined,
    limit: number,
    offset: number,
  ): ApkUploadRecord[] {
    let records = Array.from(this.memoryStore.values()).filter(r => r.tenantId === tenantId);

    if (options?.market) {
      records = records.filter(r => r.market === options.market);
    }
    if (options?.status) {
      records = records.filter(r => r.status === options.status);
    }

    return records
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }
}

export default ApkUploadHistoryService;
