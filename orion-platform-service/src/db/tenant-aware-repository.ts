/**
 * TenantAwareRepository - 租户隔离感知的 Repository 基类
 *
 * 功能：
 * - 继承 BaseRepository 并自动添加 tenant_id 过滤
 * - 提供 Repository 层的租户隔离验证
 * - 所有 CRUD 操作自动包含 tenant_id 条件
 *
 * RLS 隔离改进：
 * - getCurrentTenantId() 优先从 AsyncLocalStorage 获取（请求上下文）
 * - fallback 到全局 tenantContext（后台任务/启动期场景）
 */

import { BaseRepository, FindAllOptions, FindAllResult } from '../db/base-repository';
import { tenantContextStorage, SYSTEM_TENANT_ID } from '../db/tenant-context-storage';
import { tenantContext } from '../services/tenant/TenantContext';
import pino from 'pino';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * 租户感知查询选项
 */
export interface TenantAwareFindOptions extends FindAllOptions {
  /** 强制指定 tenant_id（覆盖当前上下文） */
  forceTenantId?: number;
  /** 系统租户模式：允许查询所有租户数据 */
  systemTenantMode?: boolean;
}

/**
 * TenantAwareRepository - 自动添加租户隔离的 Repository 基类
 *
 * 使用方法：
 * ```typescript
 * class MyRepository extends TenantAwareRepository<MyEntity> {
 *   constructor(db) {
 *     super(db, 'my_table');
 *   }
 * }
 * ```
 */
export abstract class TenantAwareRepository<T extends { id: string }> extends BaseRepository<T> {
  constructor(
    db: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tableName: string,
    tenantIdColumn: string = 'tenant_id',
  ) {
    super(db, tableName);
  }

  /**
   * 获取当前租户 ID
   *
   * 优先级：
   * 1. AsyncLocalStorage（HTTP 请求上下文）
   * 2. 全局 tenantContext（后台任务/启动期 fallback）
   */
  protected getCurrentTenantId(): number | null {
    // 优先从 ALS 获取（请求级上下文，无竞态条件）
    const store = tenantContextStorage.getStore();
    if (store) {
      // 系统租户模式下返回 null（不添加租户过滤）
      if (store.isSystemTenant) return null;
      return store.tenantId;
    }

    // Fallback 到全局单例（后台任务、启动期）
    return tenantContext.getCurrentTenantId();
  }

  /**
   * 检查是否启用租户隔离
   */
  protected isTenantIsolationEnabled(): boolean {
    // ALS 系统租户模式下禁用隔离
    const store = tenantContextStorage.getStore();
    if (store?.isSystemTenant) return false;
    return tenantContext.isEnabled();
  }

  /**
   * 构建带 tenant_id 的 WHERE 条件
   */
  protected buildTenantWhere(
    baseWhere: string,
    tenantId: number,
    existingParamCount: number = 0,
  ): { whereClause: string; tenantParamIndex: number } {
    const tenantParamIndex = existingParamCount + 1;
    const tenantCondition = `tenant_id = $${tenantParamIndex}`;

    const whereClause = baseWhere
      ? `${baseWhere} AND ${tenantCondition}`
      : `WHERE ${tenantCondition}`;

    return { whereClause, tenantParamIndex };
  }

  /**
   * 按ID查询（自动添加 tenant_id 过滤）
   */
  async findById(id: string, options?: TenantAwareFindOptions): Promise<T | undefined> {
    const tenantId = options?.forceTenantId ?? this.getCurrentTenantId();

    // 系统租户模式或租户隔离禁用时，不添加 tenant_id 过滤
    if (options?.systemTenantMode || !this.isTenantIsolationEnabled()) {
      return super.findById(id);
    }

    // 添加 tenant_id 过滤
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 查询所有（自动添加 tenant_id 过滤）
   */
  async findAll(options: TenantAwareFindOptions = {}): Promise<FindAllResult<T>> {
    const tenantId = options.forceTenantId ?? this.getCurrentTenantId();

    // 系统租户模式或租户隔离禁用时，不添加 tenant_id 过滤
    if (options.systemTenantMode || !this.isTenantIsolationEnabled()) {
      return super.findAll(options);
    }

    const { where = {}, orderBy = 'created_at', orderDir = 'DESC', limit = 20, offset = 0 } = options;

    // 验证标识符
    const validIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!validIdentifier.test(orderBy)) {
      throw new Error(`Invalid order by column: ${orderBy}`);
    }
    const validatedOrderDir = orderDir === 'ASC' ? 'ASC' : 'DESC';

    let query = `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`;
    const queryParams: any[] = [tenantId];
    let paramIndex = 2;

    // 添加其他 WHERE 条件
    for (const [key, value] of Object.entries(where)) {
      if (!validIdentifier.test(key)) {
        throw new Error(`Invalid where column: ${key}`);
      }
      if (value !== undefined && value !== null) {
        query += ` AND ${key} = $${paramIndex}`;
        queryParams.push(value);
        paramIndex++;
      }
    }

    query += ` ORDER BY ${orderBy} ${validatedOrderDir} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await this.db.query(query, queryParams);

    // 构建计数查询
    const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE tenant_id = $1` +
      query.slice(query.indexOf('WHERE tenant_id = $1') + 'WHERE tenant_id = $1'.length, query.indexOf(' ORDER BY'));

    const countResult = await this.db.query(countQuery, queryParams.slice(0, -2));

    return {
      entities: result.rows.map((row: any) => this.mapRowToEntity(row)),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * 创建记录（自动添加 tenant_id）
   */
  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<T, 'id'>> & { tenant_id?: number }): Promise<T> {
    const tenantId = data.tenant_id ?? this.getCurrentTenantId();

    // 确保数据包含 tenant_id
    const dataWithTenant = {
      ...data,
      tenant_id: tenantId,
    } as Omit<T, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<T, 'id'>>;

    return super.create(dataWithTenant);
  }

  /**
   * 更新记录（自动验证 tenant_id）
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>, options?: TenantAwareFindOptions): Promise<T> {
    const tenantId = options?.forceTenantId ?? this.getCurrentTenantId();

    // 系统租户模式或租户隔离禁用时，不添加 tenant_id 过滤
    if (options?.systemTenantMode || !this.isTenantIsolationEnabled()) {
      return super.update(id, data as Partial<Omit<T, 'id' | 'created_at'>>);
    }

    const columns = Object.keys(data);
    const values = Object.values(data);

    if (columns.length === 0) {
      throw new OrionError(ErrorCode.OPERATION_FAILED, 'Update requires at least one column');
    }

    // 验证列名
    const validIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    for (const col of columns) {
      if (!validIdentifier.test(col)) {
        throw new Error(`Invalid column name: ${col}`);
      }
    }

    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${columns.length + 1} AND tenant_id = $${columns.length + 2} RETURNING *`;
    const result = await this.db.query(query, [...values, id, tenantId]);

    if (result.rows.length === 0) {
      throw new Error(`UPDATE on ${this.tableName} affected no rows (id: ${id}, tenant_id: ${tenantId}) - possible tenant mismatch`);
    }

    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 删除记录（自动验证 tenant_id）
   */
  async delete(id: string, options?: TenantAwareFindOptions): Promise<boolean> {
    const tenantId = options?.forceTenantId ?? this.getCurrentTenantId();

    // 系统租户模式或租户隔离禁用时，不添加 tenant_id 过滤
    if (options?.systemTenantMode || !this.isTenantIsolationEnabled()) {
      return super.delete(id);
    }

    const result = await this.db.query(
      `DELETE FROM ${this.tableName} WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 按租户查询所有记录
   */
  async findByTenantId(tenantId: number, options?: { limit?: number; offset?: number }): Promise<T[]> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset],
    );

    return result.rows.map((row: any) => this.mapRowToEntity(row));
  }

  /**
   * 验证资源属于当前租户
   */
  async validateResourceTenant(resourceId: string): Promise<boolean> {
    const tenantId = this.getCurrentTenantId();

    if (!tenantId || !this.isTenantIsolationEnabled()) {
      return true;
    }

    const result = await this.db.query(
      `SELECT tenant_id FROM ${this.tableName} WHERE id = $1`,
      [resourceId],
    );

    if (result.rows.length === 0) {
      return false;
    }

    const resourceTenantId = result.rows[0].tenant_id;
    return tenantContext.validateResourceTenant(resourceTenantId);
  }
}