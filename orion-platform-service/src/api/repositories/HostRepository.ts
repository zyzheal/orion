/**
 * Host Repository - 主机资源数据访问层
 */

import { DatabasePool } from '../../services/database';

export interface HostResource {
  id: string;
  tenantId: bigint;
  ciId: string;
  groupId?: string;
  hostname: string;
  ipAddress: string;
  osType?: string;
  osVersion?: string;
  cpuCores?: number;
  memoryMb?: number;
  diskGb?: number;
  status: string;
  sshPort: number;
  sshUser?: string;
  labels: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface HostFilters {
  tenantId: bigint;
  groupId?: string;
  status?: string;
  search?: string;
  labels?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export interface HostListResponse {
  data: HostResource[];
  total: number;
  limit: number;
  offset: number;
}

export class HostRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  /**
   * 创建主机资源
   */
  async createHost(input: {
    tenantId: bigint;
    ciId: string;
    groupId?: string;
    hostname: string;
    ipAddress: string;
    osType?: string;
    osVersion?: string;
    cpuCores?: number;
    memoryMb?: number;
    diskGb?: number;
    status: string;
    sshPort?: number;
    sshUser?: string;
    labels?: Record<string, string>;
    createdBy: string;
  }): Promise<HostResource> {
    const query = `
      INSERT INTO cmdb_host (
        tenant_id, ci_id, group_id, hostname, ip_address,
        os_type, os_version, cpu_cores, memory_mb, disk_gb,
        status, ssh_port, ssh_user, labels, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.ciId,
      input.groupId || null,
      input.hostname,
      input.ipAddress,
      input.osType || null,
      input.osVersion || null,
      input.cpuCores || null,
      input.memoryMb || null,
      input.diskGb || null,
      input.status,
      input.sshPort || 22,
      input.sshUser || null,
      JSON.stringify(input.labels || {}),
      input.createdBy,
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToHost(result.rows[0]);
  }

  /**
   * 通过 ID 获取主机
   */
  async getHostById(id: string): Promise<HostResource | null> {
    const query = `
      SELECT * FROM cmdb_host
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToHost(result.rows[0]);
  }

  /**
   * 通过 ciId 获取主机
   */
  async getHostByCiId(ciId: string, tenantId: bigint): Promise<HostResource | null> {
    const query = `
      SELECT * FROM cmdb_host
      WHERE ci_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [ciId, tenantId.toString()]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToHost(result.rows[0]);
  }

  /**
   * 更新主机
   */
  async updateHost(
    id: string,
    input: Partial<HostResource>,
    user: string
  ): Promise<HostResource | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const updatableFields = [
      'group_id', 'hostname', 'ip_address', 'os_type', 'os_version',
      'cpu_cores', 'memory_mb', 'disk_gb', 'status', 'ssh_port',
      'ssh_user', 'labels',
    ];

    for (const field of updatableFields) {
      const key = field.replace('_id', 'Id').replace('_', '') as keyof HostResource;
      if (input[key as keyof HostResource] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(input[key as keyof HostResource]);
      }
    }

    if (updates.length === 0) {
      return this.getHostById(id);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `
      UPDATE cmdb_host
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.database.query(query, params);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToHost(result.rows[0]);
  }

  /**
   * 删除主机（软删除）
   */
  async deleteHost(id: string): Promise<boolean> {
    const query = `
      UPDATE cmdb_host
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * 查询主机列表
   */
  async listHosts(filters: HostFilters): Promise<HostListResponse> {
    const whereClauses: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    // 租户过滤
    whereClauses.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId.toString());

    if (filters.groupId) {
      whereClauses.push(`group_id = $${paramIndex++}`);
      params.push(filters.groupId);
    }
    if (filters.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters.search) {
      whereClauses.push(`(hostname ILIKE $${paramIndex++} OR ip_address::text ILIKE $${paramIndex++})`);
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const whereClause = whereClauses.join(' AND ');

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM cmdb_host WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // 获取数据
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const dataQuery = `
      SELECT * FROM cmdb_host
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.database.query(dataQuery, params);
    const data = result.rows.map((row: any) => this.mapRowToHost(row));

    return { data, total, limit, offset };
  }

  /**
   * 将数据库行映射为 Host 对象
   */
  private mapRowToHost(row: any): HostResource {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      ciId: row.ci_id,
      groupId: row.group_id,
      hostname: row.hostname,
      ipAddress: row.ip_address,
      osType: row.os_type,
      osVersion: row.os_version,
      cpuCores: row.cpu_cores,
      memoryMb: row.memory_mb,
      diskGb: row.disk_gb,
      status: row.status,
      sshPort: row.ssh_port,
      sshUser: row.ssh_user,
      labels: row.labels || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }
}
