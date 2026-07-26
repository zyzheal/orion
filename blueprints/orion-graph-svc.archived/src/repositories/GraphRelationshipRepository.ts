/**
 * GraphRelationshipRepository — Graph 关系数据访问层
 *
 * 负责 graph_relationships 表的 CRUD 操作，支持按类型、起止节点查询。
 */

import type { IDbAdapter } from '../db/database';
import type { GraphRelationship } from '../types/graph';

export class GraphRelationshipRepository {
  constructor(private pool: IDbAdapter) {}

  async create(rel: Omit<GraphRelationship, 'id'>): Promise<GraphRelationship> {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO graph_relationships (id, type, start_node_id, end_node_id, properties, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [id, rel.type, rel.startNodeId, rel.endNodeId, JSON.stringify(rel.properties)],
    );
    return this.rowToRel(result.rows[0]);
  }

  async findById(id: string): Promise<GraphRelationship | null> {
    const result = await this.pool.query('SELECT * FROM graph_relationships WHERE id = $1', [id]);
    return result.rows[0] ? this.rowToRel(result.rows[0]) : null;
  }

  async findByType(tenantId: string, type: string): Promise<GraphRelationship[]> {
    const result = await this.pool.query(
      `SELECT gr.* FROM graph_relationships gr
       INNER JOIN graph_nodes sn ON gr.start_node_id = sn.id
       WHERE sn.tenant_id = $1 AND gr.type = $2
       ORDER BY gr.created_at DESC`,
      [tenantId, type],
    );
    return result.rows.map(r => this.rowToRel(r));
  }

  async findByNodeId(nodeId: string): Promise<GraphRelationship[]> {
    const result = await this.pool.query(
      `SELECT * FROM graph_relationships
       WHERE start_node_id = $1 OR end_node_id = $1
       ORDER BY created_at DESC`,
      [nodeId],
    );
    return result.rows.map(r => this.rowToRel(r));
  }

  async findByStartNode(startNodeId: string): Promise<GraphRelationship[]> {
    const result = await this.pool.query(
      'SELECT * FROM graph_relationships WHERE start_node_id = $1 ORDER BY created_at DESC',
      [startNodeId],
    );
    return result.rows.map(r => this.rowToRel(r));
  }

  async update(id: string, rel: Partial<GraphRelationship>): Promise<GraphRelationship | null> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (rel.type !== undefined) {
      updates.push(`type = $${idx++}`);
      params.push(rel.type);
    }
    if (rel.startNodeId !== undefined) {
      updates.push(`start_node_id = $${idx++}`);
      params.push(rel.startNodeId);
    }
    if (rel.endNodeId !== undefined) {
      updates.push(`end_node_id = $${idx++}`);
      params.push(rel.endNodeId);
    }
    if (rel.properties !== undefined) {
      updates.push(`properties = $${idx++}`);
      params.push(JSON.stringify(rel.properties));
    }

    if (updates.length === 0) return this.findById(id);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE graph_relationships SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows[0] ? this.rowToRel(result.rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM graph_relationships WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteByNodeId(nodeId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM graph_relationships WHERE start_node_id = $1 OR end_node_id = $1',
      [nodeId],
    );
    return result.rowCount ?? 0;
  }

  private rowToRel(row: any): GraphRelationship {
    return {
      id: row.id,
      type: row.type,
      startNodeId: row.start_node_id,
      endNodeId: row.end_node_id,
      properties: typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties ?? {},
    };
  }
}
