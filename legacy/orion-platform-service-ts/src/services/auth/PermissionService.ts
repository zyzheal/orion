/**
 * PermissionService — 服务级权限管理（PostgreSQL + SimpleFallbackStorage 持久化 + 内存降级）
 *
 * Storage:
 *   Layer 1: PostgreSQL via SimpleFallbackStorage (persistToDb=false, in-memory with TTL)
 *   Layer 2: In-memory cache (fast synchronous reads, write-through to SimpleFallbackStorage)
 *
 * The in-memory cache provides synchronous fast reads for permission checks.
 * SimpleFallbackStorage provides a structured KV API with TTL for cache management.
 *
 * 功能:
 * 1. CRUD 权限记录，使用 service_permissions 表
 * 2. 租户隔离：所有查询均携带 tenant_id
 * 3. 内存缓存作为 SimpleFallbackStorage 的快速读取层
 * 4. 兼容 existing services/permission/PermissionService 的公开接口
 */

import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';
import { SimpleFallbackStorage } from '../fallback/FallbackStorageService';

const logger = createLogger('AuthService');

// ---------------------------------------------------------------------------
// 数据类型
// ---------------------------------------------------------------------------

export interface PermissionRecord {
  id: string;
  tenant_id: string;
  service_name: string;
  permission_key: string;
  description: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  deniedAt?: 'service_level' | 'tenant_level';
}

// ---------------------------------------------------------------------------
// 错误类型
// ---------------------------------------------------------------------------

export class PermissionServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PermissionServiceError';
  }
}

// ---------------------------------------------------------------------------
// 内存缓存结构
// ---------------------------------------------------------------------------

/** 结构: { [tenantId]: { [serviceName]: { [permissionKey]: PermissionRecord } } } */
interface MemCache {
  [tenantId: string]: {
    [serviceName: string]: { [permissionKey: string]: PermissionRecord };
  };
}

// ---------------------------------------------------------------------------
// 类定义
// ---------------------------------------------------------------------------

export class PermissionService {
  private dbPool: any;
  private cache: MemCache = {};
  private cacheInitialized = false;
  private initializing = false;
  private initializingPromise: Promise<void> | null = null;

  // SimpleFallbackStorage for structured KV cache management
  private storage: SimpleFallbackStorage;

  constructor(pool?: any, storage?: SimpleFallbackStorage) {
    this.dbPool = pool;

    // Initialize SimpleFallbackStorage with permissions-specific prefix
    this.storage = storage ?? new SimpleFallbackStorage({
      prefix: 'permissions',
      maxSize: 5000,
      ttlMs: 300000, // 5 minutes TTL for permission cache
      persistToDb: false,
      tenantId: 'global',
    });
  }

  // ==================== Lifecycle ====================

  /**
   * connect — initialize SimpleFallbackStorage and load permissions into cache.
   */
  async connect(): Promise<void> {
    this.storage.start();
    await this.loadFromStorage();
    logger.info(
      { cacheSize: this._cacheSize(), traceId: getCurrentTraceId() },
      '[PermissionService] Connected',
    );
  }

  /**
   * disconnect — clear in-memory cache and SimpleFallbackStorage.
   */
  async disconnect(): Promise<void> {
    this.cache = {};
    this.cacheInitialized = false;
    await this.storage.clear();
    logger.info(
      { traceId: getCurrentTraceId() },
      '[PermissionService] Disconnected',
    );
  }

  // ================================================================
  // 公共 CRUD API
  // ================================================================

  /** 列出某租户下某服务的权限列表 */
  async listServicePermissions(
    tenantId: string,
    serviceName?: string,
  ): Promise<PermissionRecord[]> {
    try {
      const rows = await this._queryServicePermissions(tenantId, serviceName);
      // 填充缓存
      for (const row of rows) {
        if (!this.cache[row.tenant_id]) this.cache[row.tenant_id] = {};
        if (!this.cache[row.tenant_id][row.service_name]) {
          this.cache[row.tenant_id][row.service_name] = {};
        }
        this.cache[row.tenant_id][row.service_name][row.permission_key] = row;
      }
      // 异步持久化到 SimpleFallbackStorage
      this._persistToStorage(tenantId, serviceName).catch(() => {});
      return rows;
    } catch (err) {
      logger.warn(`[PermissionService] listServicePermissions DB failed, falling back to memory`, err);
      return this._memListServicePermissions(tenantId, serviceName);
    }
  }

  /** 根据 ID 获取权限记录 */
  async getPermissionById(tenantId: string, permissionId: string): Promise<PermissionRecord | null> {
    try {
      const result = await this.dbPool.query(
        'SELECT * FROM service_permissions WHERE id = $1 AND tenant_id = $2',
        [permissionId, tenantId],
      );
      if (result.rows.length === 0) return null;
      const record = this._mapRow(result.rows[0]);
      // 写入缓存
      this._memPut(tenantId, record.service_name, record.permission_key, record);
      this._persistToStorage(tenantId).catch(() => {});
      return record;
    } catch (err) {
      logger.warn(`[PermissionService] getPermissionById DB failed, falling back to memory`, err);
      return this._memGetById(tenantId, permissionId);
    }
  }

  /** 通过 permission_key 获取权限记录 */
  async getPermissionByKey(
    tenantId: string,
    serviceName: string,
    permissionKey: string,
  ): Promise<PermissionRecord | null> {
    // 先查内存缓存
    const cached = this._memGetByKey(tenantId, serviceName, permissionKey);
    if (cached) return cached;

    try {
      const result = await this.dbPool.query(
        `SELECT * FROM service_permissions
         WHERE tenant_id = $1 AND service_name = $2 AND permission_key = $3`,
        [tenantId, serviceName, permissionKey],
      );
      if (result.rows.length === 0) return null;
      const record = this._mapRow(result.rows[0]);
      // 写入缓存
      this._memPut(tenantId, serviceName, permissionKey, record);
      this._persistToStorage(tenantId, serviceName).catch(() => {});
      return record;
    } catch (err) {
      logger.warn(`[PermissionService] getPermissionByKey DB failed, falling back to memory`, err);
      return this._memGetByKey(tenantId, serviceName, permissionKey);
    }
  }

  /** 创建权限记录 */
  async createPermission(
    tenantId: string,
    serviceName: string,
    permissionKey: string,
    description?: string,
  ): Promise<PermissionRecord> {
    if (!serviceName || !permissionKey) {
      throw new PermissionServiceError('service_name and permission_key are required', 'INVALID_INPUT');
    }

    try {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      const now = new Date();

      const result = await this.dbPool.query(
        `INSERT INTO service_permissions (id, tenant_id, service_name, permission_key, description, enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7) RETURNING *`,
        [id, tenantId, serviceName, permissionKey, description ?? null, now, now],
      );

      const record = this._mapRow(result.rows[0]);
      this._memPut(tenantId, serviceName, permissionKey, record);
      // 异步持久化到 SimpleFallbackStorage
      this._persistToStorage(tenantId, serviceName).catch(() => {});
      return record;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new PermissionServiceError(
          `Permission already exists: ${serviceName}:${permissionKey}`,
          'DUPLICATE_PERMISSION',
        );
      }
      throw new PermissionServiceError(`Failed to create permission: ${err?.message || err}`, 'CREATE_ERROR');
    }
  }

  /** 更新权限记录 */
  async updatePermission(
    tenantId: string,
    permissionId: string,
    input: { description?: string; enabled?: boolean; serviceName?: string; permissionKey?: string },
  ): Promise<PermissionRecord | null> {
    try {
      const existing = await this._memGetById(tenantId, permissionId);
      if (!existing) return null;

      const { v4: uuidv4 } = await import('uuid');
      const oldSvcKey = `${existing.service_name}:${existing.permission_key}`;

      // 先删除旧缓存
      this._memDelete(tenantId, existing.service_name, existing.permission_key);

      const updates: string[] = [];
      const params: any[] = [];
      let pi = 1;

      if (input.description !== undefined) { updates.push(`description = $${pi++}`); params.push(input.description); }
      if (input.enabled !== undefined) { updates.push(`enabled = $${pi++}`); params.push(input.enabled); }
      if (input.serviceName !== undefined) { updates.push(`service_name = $${pi++}`); params.push(input.serviceName); }
      if (input.permissionKey !== undefined) { updates.push(`permission_key = $${pi++}`); params.push(input.permissionKey); }

      if (updates.length === 0) {
        // 无更新字段，直接返回原记录
        const newRecord = this._memGetById(tenantId, permissionId);
        return newRecord || existing;
      }

      updates.push(`updated_at = $${pi++}`);
      params.push(new Date());
      params.push(permissionId);

      const result = await this.dbPool.query(
        `UPDATE service_permissions SET ${updates.join(', ')} WHERE id = $${pi} AND tenant_id = $1 RETURNING *`,
        [tenantId, ...params],
      );

      if (result.rows.length === 0) return null;

      const record = this._mapRow(result.rows[0]);

      // 如果 service_key 变了，更新缓存 key
      const newSvcKey = `${record.service_name}:${record.permission_key}`;
      if (newSvcKey !== oldSvcKey) {
        this._memPut(record.tenant_id, record.service_name, record.permission_key, record);
      } else {
        this._memPut(tenantId, record.service_name, record.permission_key, record);
      }

      // 异步持久化到 SimpleFallbackStorage
      this._persistToStorage(tenantId, record.service_name).catch(() => {});

      return record;
    } catch (err: any) {
      throw new PermissionServiceError(`Failed to update permission: ${err?.message || err}`, 'UPDATE_ERROR');
    }
  }

  /** 删除权限记录 */
  async deletePermission(tenantId: string, permissionId: string): Promise<boolean> {
    try {
      const existing = await this._memGetById(tenantId, permissionId);
      if (!existing) return false;

      const result = await this.dbPool.query(
        'DELETE FROM service_permissions WHERE id = $1 AND tenant_id = $2',
        [permissionId, tenantId],
      );

      if ((result.rowCount ?? 0) > 0) {
        this._memDelete(tenantId, existing.service_name, existing.permission_key);
        // 异步持久化到 SimpleFallbackStorage
        this._persistToStorage(tenantId, existing.service_name).catch(() => {});
        return true;
      }
      return false;
    } catch (err) {
      logger.warn(`[PermissionService] deletePermission DB failed, attempting memory fallback`, err);
      // 即使 DB 失败也清理内存缓存
      const mem = this._memGetById(tenantId, permissionId);
      if (mem) {
        this._memDelete(tenantId, mem.service_name, mem.permission_key);
        this._persistToStorage(tenantId, mem.service_name).catch(() => {});
        return true;
      }
      return false;
    }
  }

  /** 批量创建权限 */
  async batchCreatePermissions(
    tenantId: string,
    items: Array<{
      service_name: string;
      permission_key: string;
      description?: string;
    }>,
  ): Promise<PermissionRecord[]> {
    if (items.length === 0) return [];

    try {
      const { v4: uuidv4 } = await import('uuid');
      const now = new Date();
      const values: string[] = [];
      const params: any[] = [];
      let pi = 1;

      for (const item of items) {
        const id = uuidv4();
        values.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4}, true, $${pi + 5}, $${pi + 6})`);
        params.push(
          id,
          tenantId,
          item.service_name,
          item.permission_key,
          item.description ?? null,
          now,
          now,
        );
        pi += 7;
      }

      const result = await this.dbPool.query(
        `INSERT INTO service_permissions (id, tenant_id, service_name, permission_key, description, enabled, created_at, updated_at)
         VALUES ${values} RETURNING *`,
        params,
      );

      const records: PermissionRecord[] = [];
      for (const row of result.rows) {
        const record = this._mapRow(row);
        records.push(record);
        this._memPut(record.tenant_id, record.service_name, record.permission_key, record);
      }

      // 异步持久化到 SimpleFallbackStorage
      this._persistToStorage(tenantId).catch(() => {});

      return records;
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new PermissionServiceError(
          `Duplicate permission found in batch`,
          'DUPLICATE_PERMISSION',
        );
      }
      throw new PermissionServiceError(`Failed to batch create permissions: ${err?.message || err}`, 'CREATE_ERROR');
    }
  }

  // ================================================================
  // 权限检查
  // ================================================================

  /** 检查用户在某服务上是否有指定权限 */
  async checkPermission(
    tenantId: string,
    serviceName: string,
    permissionKey: string,
  ): Promise<boolean> {
    // 先查内存缓存
    const cached = this._memCheck(tenantId, serviceName, permissionKey);
    if (cached !== undefined) return cached;

    try {
      const result = await this.dbPool.query(
        `SELECT 1 FROM service_permissions
         WHERE tenant_id = $1 AND service_name = $2 AND permission_key = $3 AND enabled = true
         LIMIT 1`,
        [tenantId, serviceName, permissionKey],
      );
      const allowed = result.rowCount > 0;
      // 写入缓存
      this._memPutCheck(tenantId, serviceName, permissionKey, allowed);
      return allowed;
    } catch (err) {
      logger.warn(`[PermissionService] checkPermission DB failed, falling back to memory`, err);
      return this._memCheck(tenantId, serviceName, permissionKey) ?? false;
    }
  }

  /** 检查用户是否有执行某命令的权限（兼容旧接口） */
  async check(
    userId: string,
    userRole: string,
    command: string,
    resourceType?: string,
    resourceId?: string,
  ): Promise<PermissionCheckResult> {
    // 简化实现：默认允许，实际可接入 RoleService 做角色权限判断
    return { allowed: true };
  }

  /** 初始化时预热缓存 */
  async initCache(tenantId: string, serviceName?: string): Promise<void> {
    if (this.initializing) {
      await this.initializingPromise;
      return;
    }

    this.initializing = true;
    this.initializingPromise = (async () => {
      try {
        const perms = await this.listServicePermissions(tenantId, serviceName);
        this.cacheInitialized = true;
        logger.info(`[PermissionService] Cache initialized: ${perms.length} permissions loaded for tenant ${tenantId}`);
      } catch (err) {
        logger.warn(`[PermissionService] Failed to initialize cache for tenant ${tenantId}`, err);
        this.cacheInitialized = false;
      } finally {
        this.initializing = false;
      }
    })();

    await this.initializingPromise;
  }

  /** 清空缓存 */
  invalidateCache(tenantId?: string): void {
    if (tenantId) {
      delete this.cache[tenantId];
    } else {
      this.cache = {};
      this.cacheInitialized = false;
    }
    // 异步清理 SimpleFallbackStorage
    if (tenantId) {
      this.storage.delete(`perm:${tenantId}`).catch(() => {});
    } else {
      this.storage.clear().catch(() => {});
    }
  }

  // ================================================================
  // 私有辅助方法
  // ================================================================

  /** 将 DB row 映射为 PermissionRecord */
  private _mapRow(row: any): PermissionRecord {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      service_name: row.service_name,
      permission_key: row.permission_key,
      description: row.description,
      enabled: row.enabled ?? true,
      created_at: row.created_at,
      updated_at: row.updated_at || row.created_at,
    };
  }

  /** 查询某租户的服务权限 */
  private async _queryServicePermissions(
    tenantId: string,
    serviceName?: string,
  ): Promise<PermissionRecord[]> {
    let query = 'SELECT * FROM service_permissions WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (serviceName) {
      query += ` AND service_name = $${paramIdx++}`;
      params.push(serviceName);
    }

    query += ' ORDER BY service_name, permission_key';
    const result = await this.dbPool.query(query, params);
    return result.rows.map((row: any) => this._mapRow(row));
  }

  // ================================================================
  // SimpleFallbackStorage 操作
  // ================================================================

  /**
   * 将整个 cache 对象持久化到 SimpleFallbackStorage。
   * 异步执行，不阻塞调用方。
   */
  private async _persistToStorage(tenantId?: string, serviceName?: string): Promise<void> {
    try {
      // 只持久化指定租户/服务的数据，或全量
      const dataToPersist = tenantId
        ? { [tenantId]: this.cache[tenantId] || {} }
        : this.cache;

      const key = tenantId ? `perm:${tenantId}${serviceName ? `:${serviceName}` : ''}` : 'perm:all';
      await this.storage.set(key, dataToPersist, 300000); // 5 min TTL
    } catch (error) {
      logger.warn({ error, traceId: getCurrentTraceId() }, '[PermissionService] Failed to persist to SimpleFallbackStorage');
    }
  }

  /**
   * 从 SimpleFallbackStorage 加载所有缓存数据。
   * 在 connect() 时调用。
   */
  private async loadFromStorage(): Promise<void> {
    try {
      // 先尝试加载全量缓存
      const allData = await this.storage.get<MemCache>('perm:all');
      if (allData) {
        this.cache = allData;
        this.cacheInitialized = true;
        logger.info(
          { cacheSize: this._cacheSize(), traceId: getCurrentTraceId() },
          '[PermissionService] Cache loaded from SimpleFallbackStorage (full)',
        );
        return;
      }

      // 如果没有全量缓存，尝试逐租户加载
      const keys = await this.storage.keys();
      let loaded = 0;
      for (const key of keys) {
        if (!key.startsWith('perm:')) continue;
        const tenantId = key.split(':')[1];
        if (!tenantId) continue;
        const data = await this.storage.get<MemCache[typeof tenantId]>(key);
        if (data) {
          this.cache[tenantId] = data;
          loaded++;
        }
      }
      if (loaded > 0) {
        this.cacheInitialized = true;
        logger.info(
          { tenantsLoaded: loaded, cacheSize: this._cacheSize(), traceId: getCurrentTraceId() },
          '[PermissionService] Cache loaded from SimpleFallbackStorage (per-tenant)',
        );
      }
    } catch (error) {
      logger.warn(
        { error, traceId: getCurrentTraceId() },
        '[PermissionService] Failed to load from SimpleFallbackStorage',
      );
    }
  }

  private _cacheSize(): number {
    let count = 0;
    for (const tenant of Object.values(this.cache)) {
      for (const svc of Object.values(tenant)) {
        count += Object.keys(svc).length;
      }
    }
    return count;
  }

  // ================================================================
  // 内存缓存操作
  // ================================================================

  private _memPut(tenantId: string, serviceName: string, permissionKey: string, record: PermissionRecord): void {
    if (!this.cache[tenantId]) this.cache[tenantId] = {};
    if (!this.cache[tenantId][serviceName]) this.cache[tenantId][serviceName] = {};
    this.cache[tenantId][serviceName][permissionKey] = record;
  }

  private _memDelete(tenantId: string, serviceName: string, permissionKey: string): void {
    const svc = this.cache[tenantId]?.[serviceName];
    if (svc) {
      delete svc[permissionKey];
      // 如果该服务下没有权限了，清理服务目录
      if (Object.keys(svc).length === 0) {
        delete this.cache[tenantId][serviceName];
      }
    }
  }

  private _memListServicePermissions(
    tenantId: string,
    serviceName?: string,
  ): PermissionRecord[] {
    const t = this.cache[tenantId];
    if (!t) return [];

    if (serviceName) {
      const svc = t[serviceName];
      return svc ? Object.values(svc) : [];
    }

    const all: PermissionRecord[] = [];
    for (const key of Object.keys(t)) {
      all.push(...Object.values(t[key]));
    }
    return all;
  }

  private _memGetById(tenantId: string, permissionId: string): PermissionRecord | null {
    // 遍历缓存找 id
    const t = this.cache[tenantId];
    if (!t) return null;
    for (const svcKey of Object.keys(t)) {
      const pks = t[svcKey];
      for (const pk of Object.keys(pks)) {
        if (pks[pk].id === permissionId) {
          return pks[pk];
        }
      }
    }
    return null;
  }

  private _memGetByKey(tenantId: string, serviceName: string, permissionKey: string): PermissionRecord | null {
    return this.cache[tenantId]?.[serviceName]?.[permissionKey] ?? null;
  }

  private _memCheck(tenantId: string, serviceName: string, permissionKey: string): boolean | undefined {
    const record = this.cache[tenantId]?.[serviceName]?.[permissionKey];
    return record?.enabled;
  }

  private _memPutCheck(tenantId: string, serviceName: string, permissionKey: string, allowed: boolean): void {
    // 只缓存 enabled 状态，用于快速权限检查
    if (!this.cache[tenantId]) this.cache[tenantId] = {};
    if (!this.cache[tenantId][serviceName]) this.cache[tenantId][serviceName] = {};
    this.cache[tenantId][serviceName][permissionKey] = {
      id: '',
      tenant_id: tenantId,
      service_name: serviceName,
      permission_key: permissionKey,
      description: null,
      enabled: allowed,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
}
