/**
 * GraphNodeRepository — Graph 节点数据访问层
 *
 * 负责 graph_nodes 表的 CRUD 操作，支持按 label、tenant 查询。
 */

import type { IDbAdapter } from '../db/database';
import type { GraphNode } from '../types/graph';

export class GraphNodeRepository {
  constructor(private pool: IDbAdapter) {}

  async create(node: Omit<GraphNode, 'id'>): Promise<GraphNode> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO graph_nodes (id, labels, properties, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [id, JSON.stringify(node.labels), JSON.stringify(node.properties)],
    );
    return this.rowToNode(result.rows[0]);
  }

  async findById(id: string): Promise<GraphNode | null> {
    const result = await this.pool.query('SELECT * FROM graph_nodes WHERE id = $1', [id]);
    return result.rows[0] ? this.rowToNode(result.rows[0]) : null;
  }

  async findByLabel(tenantId: string, label: string): Promise<GraphNode[]> {
    const result = await this.pool.query(
      `SELECT gn.* FROM graph_nodes gn
       INNER JOIN graph_node_labels gnl ON gn.id = gnl.node_id
       WHERE gn.tenant_id = $1 AND gnl.label = $2`,
      [tenantId, label],
    );
    return result.rows.map(r => this.rowToNode(r));
  }

  async findByTenant(tenantId: string, limit = 100): Promise<GraphNode[]> {
    const result = await this.pool.query(
      'SELECT * FROM graph_nodes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [tenantId, limit],
    );
    return result.rows.map(r => this.rowToNode(r));
  }

  async update(id: string, node: Partial<GraphNode>): Promise<GraphNode | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (node.labels !== undefined) {
      updates.push(`labels = $${idx++}`);
      params.push(JSON.stringify(node.labels));
    }
    if (node.properties !== undefined) {
      updates.push(`properties = $${idx++}`);
      params.push(JSON.stringify(node.properties));
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE graph_nodes SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.rowToNode(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM graph_nodes WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async countByTenant(tenantId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) FROM graph_nodes WHERE tenant_id = $1',
      [tenantId],
    );
    return parseInt(result.rows[0].count, 10);
  }

  private rowToNode(row: any): GraphNode {
    return {
      id: row.id,
      labels: typeof row.labels === 'string' ? JSON.parse(row.labels) : row.labels ?? [],
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties ?? {},
    };
  }
}
