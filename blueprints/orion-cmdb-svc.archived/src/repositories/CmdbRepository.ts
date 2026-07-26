/**
 * CMDB Repository - PostgreSQL data access layer
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  CmdbNode,
  CmdbApplication,
  CmdbTopology,
  CmdbReconciliation,
  CmdbEventType,
  type CmdbNodeFilters,
} from '../types/cmdb';

export class CmdbRepository {
  constructor(private pool: Pool) {}

  // ========== Nodes ==========

  async createNode(data: Omit<CmdbNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<CmdbNode> {
    const id = uuidv4();
    const now = new Date();
    await this.pool.query(
      `INSERT INTO cmdb_nodes (id, name, type, status, application_id, parent_id, attributes, tags, description, owner_id, environment, tenant_id, k8s_resource_name, k8s_namespace, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [id, data.name, data.type, data.status, data.applicationId, data.parentId,
       JSON.stringify(data.attributes), data.tags, data.description, data.ownerId,
       data.environment, data.tenantId, data.k8sResourceName, data.k8sNamespace, now, now],
    );
    return { ...data, id, createdAt: now, updatedAt: now };
  }

  async getNode(id: string): Promise<CmdbNode | null> {
    const result = await this.pool.query('SELECT * FROM cmdb_nodes WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToNode(result.rows[0]);
  }

  async listNodes(filters: CmdbNodeFilters = {}): Promise<{ items: CmdbNode[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.type) { conditions.push(`type = $${idx++}`); params.push(filters.type); }
    if (filters.status) { conditions.push(`status = $${idx++}`); params.push(filters.status); }
    if (filters.applicationId) { conditions.push(`application_id = $${idx++}`); params.push(filters.applicationId); }
    if (filters.environment) { conditions.push(`environment = $${idx++}`); params.push(filters.environment); }
    if (filters.tenantId) { conditions.push(`tenant_id = $${idx++}`); params.push(filters.tenantId); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await this.pool.query(`SELECT COUNT(*) FROM cmdb_nodes ${where}`, params);
    const result = await this.pool.query(
      `SELECT * FROM cmdb_nodes ${where} ORDER BY created_at DESC`,
      params,
    );
    return { items: result.rows.map(this.rowToNode), total: parseInt(countResult.rows[0].count, 10) };
  }

  async updateNode(id: string, updates: Partial<Omit<CmdbNode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<CmdbNode | null> {
    const existing = await this.getNode(id);
    if (!existing) return null;

    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (key === 'attributes' || key === 'tags') {
          fields.push(`${col} = $${idx++}`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${col} = $${idx++}`);
          params.push(value);
        }
      }
    }
    fields.push(`updated_at = NOW()`);
    params.push(id);

    await this.pool.query(
      `UPDATE cmdb_nodes SET ${fields.join(', ')} WHERE id = $${idx}`,
      params,
    );
    return this.getNode(id);
  }

  async deleteNode(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM cmdb_nodes WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ========== Applications ==========

  async createApplication(data: Omit<CmdbApplication, 'id' | 'createdAt' | 'updatedAt'>): Promise<CmdbApplication> {
    const id = uuidv4();
    const now = new Date();
    await this.pool.query(
      `INSERT INTO cmdb_applications (id, name, code, description, owner_id, team_ids, node_ids, dependency_ids, business_line, environment, tenant_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, data.name, data.code, data.description, data.ownerId, data.teamIds,
       data.nodeIds, data.dependencyIds, data.businessLine, data.environment,
       data.tenantId, now, now],
    );
    return { ...data, id, createdAt: now, updatedAt: now };
  }

  async getApplication(id: string): Promise<CmdbApplication | null> {
    const result = await this.pool.query('SELECT * FROM cmdb_applications WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToApplication(result.rows[0]);
  }

  async listApplications(): Promise<{ items: CmdbApplication[]; total: number }> {
    const result = await this.pool.query('SELECT * FROM cmdb_applications ORDER BY created_at DESC');
    return { items: result.rows.map(this.rowToApplication), total: result.rows.length };
  }

  // ========== Topology ==========

  async getTopology(nodeId?: string): Promise<CmdbTopology[]> {
    if (nodeId) {
      const result = await this.pool.query(
        'SELECT * FROM cmdb_topology WHERE source_node_id = $1 OR target_node_id = $1 ORDER BY created_at',
        [nodeId],
      );
      return result.rows.map(this.rowToTopology);
    }
    const result = await this.pool.query('SELECT * FROM cmdb_topology ORDER BY created_at');
    return result.rows.map(this.rowToTopology);
  }

  async addTopologyEntry(sourceNodeId: string, targetNodeId: string, relationType: string): Promise<CmdbTopology> {
    const id = uuidv4();
    const now = new Date();
    await this.pool.query(
      `INSERT INTO cmdb_topology (id, source_node_id, target_node_id, relation_type, attributes, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, sourceNodeId, targetNodeId, relationType, '{}', null, now],
    );
    return { id, sourceNodeId, targetNodeId, relationType: relationType as CmdbTopology['relationType'], attributes: {}, createdAt: now };
  }

  // ========== Reconciliations ==========

  async saveReconciliation(data: Omit<CmdbReconciliation, 'createdAt'>): Promise<CmdbReconciliation> {
    const now = new Date();
    await this.pool.query(
      `INSERT INTO cmdb_reconciliations (id, name, reconciliation_type, status, diffs, reconciled_count, drift_count, executor_id, created_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [data.id, data.name, data.reconciliationType, data.status,
       JSON.stringify(data.diffs), data.reconciledCount, data.driftCount,
       data.executorId, now, data.completedAt],
    );
    return { ...data, createdAt: now };
  }

  async getReconciliation(id: string): Promise<CmdbReconciliation | null> {
    const result = await this.pool.query('SELECT * FROM cmdb_reconciliations WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    return this.rowToReconciliation(result.rows[0]);
  }

  // ========== Events ==========

  async publishEvent(nodeId: string, eventType: string, data: Record<string, unknown>, executorId?: string): Promise<void> {
    const id = uuidv4();
    await this.pool.query(
      `INSERT INTO cmdb_events (id, node_id, event_type, event_data, executor_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, nodeId, eventType, JSON.stringify(data), executorId],
    );
  }

  // ========== Row converters ==========

  private rowToNode(row: any): CmdbNode {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      applicationId: row.application_id,
      parentId: row.parent_id,
      attributes: row.attributes || {},
      tags: row.tags || [],
      description: row.description,
      ownerId: row.owner_id,
      environment: row.environment,
      tenantId: row.tenant_id,
      k8sResourceName: row.k8s_resource_name,
      k8sNamespace: row.k8s_namespace,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToApplication(row: any): CmdbApplication {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      ownerId: row.owner_id,
      teamIds: row.team_ids || [],
      nodeIds: row.node_ids || [],
      dependencyIds: row.dependency_ids || [],
      businessLine: row.business_line,
      environment: row.environment,
      tenantId: row.tenant_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private rowToTopology(row: any): CmdbTopology {
    return {
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      relationType: row.relation_type,
      attributes: row.attributes || {},
      description: row.description,
      createdAt: new Date(row.created_at),
    };
  }

  private rowToReconciliation(row: any): CmdbReconciliation {
    return {
      id: row.id,
      name: row.name,
      reconciliationType: row.reconciliation_type,
      status: row.status,
      diffs: row.diffs || [],
      reconciledCount: row.reconciled_count,
      driftCount: row.drift_count,
      executorId: row.executor_id,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    };
  }
}
