/**
 * K8s Repository - K8s 资源数据访问层
 */

import { DatabasePool } from '../../services/database';

export interface K8sCluster {
  id: string;
  tenantId: bigint;
  name: string;
  apiServerUrl: string;
  version?: string;
  status: string;
  nodeCount: number;
  namespaceCount: number;
  syncEnabled: boolean;
  syncStatus?: string;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface K8sNamespace {
  id: string;
  tenantId: bigint;
  clusterId: string;
  name: string;
  uid: string;
  resourceVersion?: string;
  phase: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface K8sDeployment {
  id: string;
  tenantId: bigint;
  clusterId: string;
  namespaceId?: string;
  name: string;
  uid: string;
  resourceVersion?: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  unavailableReplicas: number;
  imageList: string[];
  labels: Record<string, string>;
  spec: Record<string, any>;
  status: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface K8sPod {
  id: string;
  tenantId: bigint;
  clusterId: string;
  namespaceId?: string;
  deploymentId?: string;
  name: string;
  uid: string;
  resourceVersion?: string;
  nodeName?: string;
  hostIp?: string;
  podIp?: string;
  phase: string;
  restartCount: number;
  qosClass?: string;
  containerStatuses: Record<string, any>[];
  labels: Record<string, string>;
  spec: Record<string, any>;
  status: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface K8sFilters {
  tenantId: bigint;
  clusterId?: string;
  namespaceId?: string;
  name?: string;
  labels?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export interface K8sListResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export class K8sRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  // ==================== Cluster ====================

  /**
   * 创建 K8s 集群
   */
  async createCluster(input: {
    tenantId: bigint;
    name: string;
    apiServerUrl: string;
    version?: string;
    status: string;
    kubeConfigEncrypted?: string;
    caCert?: string;
    tokenEncrypted?: string;
    createdBy: string;
  }): Promise<K8sCluster> {
    const query = `
      INSERT INTO cmdb_k8s_cluster (
        tenant_id, name, api_server_url, version, status,
        kube_config_encrypted, ca_cert, token_encrypted, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.name,
      input.apiServerUrl,
      input.version || null,
      input.status,
      input.kubeConfigEncrypted || null,
      input.caCert || null,
      input.tokenEncrypted || null,
      input.createdBy,
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToCluster(result.rows[0]);
  }

  /**
   * 获取集群列表
   */
  async listClusters(filters: { tenantId: bigint; status?: string }): Promise<K8sCluster[]> {
    const whereClauses: string[] = ['deleted_at IS NULL'];
    const params: any[] = [filters.tenantId.toString()];
    let paramIndex = 2;

    whereClauses.push(`tenant_id = $1`);

    if (filters.status) {
      whereClauses.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const query = `
      SELECT * FROM cmdb_k8s_cluster
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at DESC
    `;

    const result = await this.database.query(query, params);
    return result.rows.map((row: any) => this.mapRowToCluster(row));
  }

  /**
   * 更新集群同步状态
   */
  async updateClusterSyncStatus(
    id: string,
    status: string,
    lastSyncAt: Date
  ): Promise<K8sCluster | null> {
    const query = `
      UPDATE cmdb_k8s_cluster
      SET sync_status = $1, last_sync_at = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await this.database.query(query, [status, lastSyncAt, id]);
    if (result.rowCount === 0) {
      return null;
    }

    return this.mapRowToCluster(result.rows[0]);
  }

  // ==================== Namespace ====================

  /**
   * 创建或更新 Namespace
   */
  async upsertNamespace(input: {
    tenantId: bigint;
    clusterId: string;
    name: string;
    uid: string;
    resourceVersion?: string;
    phase: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }): Promise<K8sNamespace> {
    const query = `
      INSERT INTO cmdb_k8s_namespace (
        tenant_id, cluster_id, name, uid, resource_version, phase, labels, annotations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (cluster_id, name, deleted_at) DO UPDATE SET
        uid = EXCLUDED.uid,
        resource_version = EXCLUDED.resource_version,
        phase = EXCLUDED.phase,
        labels = EXCLUDED.labels,
        annotations = EXCLUDED.annotations,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.clusterId,
      input.name,
      input.uid,
      input.resourceVersion || null,
      input.phase,
      JSON.stringify(input.labels || {}),
      JSON.stringify(input.annotations || {}),
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToNamespace(result.rows[0]);
  }

  /**
   * 获取 Namespace 列表
   */
  async listNamespaces(filters: K8sFilters): Promise<K8sListResponse<K8sNamespace>> {
    const whereClauses: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    whereClauses.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId.toString());

    if (filters.clusterId) {
      whereClauses.push(`cluster_id = $${paramIndex++}`);
      params.push(filters.clusterId);
    }
    if (filters.name) {
      whereClauses.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    }

    const whereClause = whereClauses.join(' AND ');
    const countQuery = `SELECT COUNT(*) as total FROM cmdb_k8s_namespace WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const dataQuery = `
      SELECT * FROM cmdb_k8s_namespace
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.database.query(dataQuery, params);
    return {
      data: result.rows.map((row: any) => this.mapRowToNamespace(row)),
      total,
      limit,
      offset,
    };
  }

  // ==================== Deployment ====================

  /**
   * 创建或更新 Deployment
   */
  async upsertDeployment(input: {
    tenantId: bigint;
    clusterId: string;
    namespaceId?: string;
    name: string;
    uid: string;
    resourceVersion?: string;
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
    imageList?: string[];
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    spec?: Record<string, any>;
    status?: Record<string, any>;
  }): Promise<K8sDeployment> {
    const query = `
      INSERT INTO cmdb_k8s_deployment (
        tenant_id, cluster_id, namespace_id, name, uid, resource_version,
        replicas, ready_replicas, available_replicas, unavailable_replicas,
        image_list, labels, annotations, spec, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (cluster_id, namespace_id, name, deleted_at) DO UPDATE SET
        uid = EXCLUDED.uid,
        resource_version = EXCLUDED.resource_version,
        replicas = EXCLUDED.replicas,
        ready_replicas = EXCLUDED.ready_replicas,
        available_replicas = EXCLUDED.available_replicas,
        unavailable_replicas = EXCLUDED.unavailable_replicas,
        image_list = EXCLUDED.image_list,
        labels = EXCLUDED.labels,
        spec = EXCLUDED.spec,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.clusterId,
      input.namespaceId || null,
      input.name,
      input.uid,
      input.resourceVersion || null,
      input.replicas || 1,
      input.readyReplicas || 0,
      input.availableReplicas || 0,
      input.unavailableReplicas || 0,
      input.imageList || [],
      JSON.stringify(input.labels || {}),
      JSON.stringify(input.annotations || {}),
      JSON.stringify(input.spec || {}),
      JSON.stringify(input.status || {}),
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToDeployment(result.rows[0]);
  }

  /**
   * 获取 Deployment 列表
   */
  async listDeployments(filters: K8sFilters): Promise<K8sListResponse<K8sDeployment>> {
    const whereClauses: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    whereClauses.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId.toString());

    if (filters.clusterId) {
      whereClauses.push(`cluster_id = $${paramIndex++}`);
      params.push(filters.clusterId);
    }
    if (filters.namespaceId) {
      whereClauses.push(`namespace_id = $${paramIndex++}`);
      params.push(filters.namespaceId);
    }
    if (filters.name) {
      whereClauses.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    }

    const whereClause = whereClauses.join(' AND ');
    const countQuery = `SELECT COUNT(*) as total FROM cmdb_k8s_deployment WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const dataQuery = `
      SELECT * FROM cmdb_k8s_deployment
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.database.query(dataQuery, params);
    return {
      data: result.rows.map((row: any) => this.mapRowToDeployment(row)),
      total,
      limit,
      offset,
    };
  }

  // ==================== Pod ====================

  /**
   * 创建或更新 Pod
   */
  async upsertPod(input: {
    tenantId: bigint;
    clusterId: string;
    namespaceId?: string;
    deploymentId?: string;
    name: string;
    uid: string;
    resourceVersion?: string;
    nodeName?: string;
    hostIp?: string;
    podIp?: string;
    phase: string;
    restartCount?: number;
    qosClass?: string;
    containerStatuses?: Record<string, any>[];
    labels?: Record<string, string>;
    spec?: Record<string, any>;
    status?: Record<string, any>;
  }): Promise<K8sPod> {
    const query = `
      INSERT INTO cmdb_k8s_pod (
        tenant_id, cluster_id, namespace_id, deployment_id, name, uid,
        resource_version, node_name, host_ip, pod_ip, phase,
        restart_count, qos_class, container_statuses, labels, spec, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (cluster_id, namespace_id, uid, deleted_at) DO UPDATE SET
        resource_version = EXCLUDED.resource_version,
        node_name = EXCLUDED.node_name,
        host_ip = EXCLUDED.host_ip,
        pod_ip = EXCLUDED.pod_ip,
        phase = EXCLUDED.phase,
        restart_count = EXCLUDED.restart_count,
        qos_class = EXCLUDED.qos_class,
        container_statuses = EXCLUDED.container_statuses,
        labels = EXCLUDED.labels,
        spec = EXCLUDED.spec,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const params = [
      input.tenantId.toString(),
      input.clusterId,
      input.namespaceId || null,
      input.deploymentId || null,
      input.name,
      input.uid,
      input.resourceVersion || null,
      input.nodeName || null,
      input.hostIp || null,
      input.podIp || null,
      input.phase,
      input.restartCount || 0,
      input.qosClass || null,
      JSON.stringify(input.containerStatuses || []),
      JSON.stringify(input.labels || {}),
      JSON.stringify(input.spec || {}),
      JSON.stringify(input.status || {}),
    ];

    const result = await this.database.query(query, params);
    return this.mapRowToPod(result.rows[0]);
  }

  /**
   * 获取 Pod 列表
   */
  async listPods(filters: K8sFilters): Promise<K8sListResponse<K8sPod>> {
    const whereClauses: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIndex = 1;

    whereClauses.push(`tenant_id = $${paramIndex++}`);
    params.push(filters.tenantId.toString());

    if (filters.clusterId) {
      whereClauses.push(`cluster_id = $${paramIndex++}`);
      params.push(filters.clusterId);
    }
    if (filters.namespaceId) {
      whereClauses.push(`namespace_id = $${paramIndex++}`);
      params.push(filters.namespaceId);
    }
    if (filters.deploymentId) {
      whereClauses.push(`deployment_id = $${paramIndex++}`);
      params.push(filters.deploymentId);
    }
    if (filters.name) {
      whereClauses.push(`name ILIKE $${paramIndex++}`);
      params.push(`%${filters.name}%`);
    }

    const whereClause = whereClauses.join(' AND ');
    const countQuery = `SELECT COUNT(*) as total FROM cmdb_k8s_pod WHERE ${whereClause}`;
    const countResult = await this.database.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    const dataQuery = `
      SELECT * FROM cmdb_k8s_pod
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.database.query(dataQuery, params);
    return {
      data: result.rows.map((row: any) => this.mapRowToPod(row)),
      total,
      limit,
      offset,
    };
  }

  // ==================== Mappers ====================

  private mapRowToCluster(row: any): K8sCluster {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      name: row.name,
      apiServerUrl: row.api_server_url,
      version: row.version,
      status: row.status,
      nodeCount: row.node_count,
      namespaceCount: row.namespace_count,
      syncEnabled: row.sync_enabled,
      syncStatus: row.sync_status,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToNamespace(row: any): K8sNamespace {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      clusterId: row.cluster_id,
      name: row.name,
      uid: row.uid,
      resourceVersion: row.resource_version,
      phase: row.phase,
      labels: row.labels || {},
      annotations: row.annotations || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  private mapRowToDeployment(row: any): K8sDeployment {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      clusterId: row.cluster_id,
      namespaceId: row.namespace_id,
      name: row.name,
      uid: row.uid,
      resourceVersion: row.resource_version,
      replicas: row.replicas,
      readyReplicas: row.ready_replicas,
      availableReplicas: row.available_replicas,
      unavailableReplicas: row.unavailable_replicas,
      imageList: row.image_list || [],
      labels: row.labels || {},
      spec: row.spec || {},
      status: row.status || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }

  private mapRowToPod(row: any): K8sPod {
    return {
      id: row.id,
      tenantId: BigInt(row.tenant_id),
      clusterId: row.cluster_id,
      namespaceId: row.namespace_id,
      deploymentId: row.deployment_id,
      name: row.name,
      uid: row.uid,
      resourceVersion: row.resource_version,
      nodeName: row.node_name,
      hostIp: row.host_ip,
      podIp: row.pod_ip,
      phase: row.phase,
      restartCount: row.restart_count,
      qosClass: row.qos_class,
      containerStatuses: row.container_statuses || [],
      labels: row.labels || {},
      spec: row.spec || {},
      status: row.status || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }
}
