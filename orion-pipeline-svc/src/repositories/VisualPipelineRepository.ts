/**
 * VisualPipelineRepository - PostgreSQL persistence for visual pipeline layouts
 */

import { DatabasePool } from '../utils/database';
import type { VisualPipeline, VisualPipelineCreateInput, VisualPipelineUpdateInput, VisualPipelineFilter, PipelineLayout } from '../models/VisualPipeline';

export class VisualPipelineRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * Create a new visual pipeline
   */
  async create(input: VisualPipelineCreateInput): Promise<VisualPipeline> {
    const result = await this.pool.query(
      `INSERT INTO visual_pipelines
        (tenant_id, pipeline_id, name, layout, yaml_definition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.tenantId,
        input.pipelineId,
        input.name,
        JSON.stringify(input.layout || { stages: [], viewport: { x: 0, y: 0, zoom: 1 } }),
        input.yamlDefinition,
        input.createdBy || null,
      ]
    );
    return this.mapRow(result.rows[0]);
  }

  /**
   * Find by ID
   */
  async findById(tenantId: string, id: string): Promise<VisualPipeline | null> {
    const result = await this.pool.query(
      'SELECT * FROM visual_pipelines WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Find by pipeline ID
   */
  async findByPipelineId(tenantId: string, pipelineId: string): Promise<VisualPipeline[]> {
    const result = await this.pool.query(
      'SELECT * FROM visual_pipelines WHERE pipeline_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [pipelineId, tenantId]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * List with filters
   */
  async findAll(filter: VisualPipelineFilter): Promise<{ data: VisualPipeline[]; total: number }> {
    const { tenantId, pipelineId, page = 1, limit = 20 } = filter;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE tenant_id = $1';
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (pipelineId) {
      whereClause += ` AND pipeline_id = $${paramIndex}`;
      params.push(pipelineId);
      paramIndex++;
    }

    // Count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM visual_pipelines ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Data
    params.push(limit, offset);
    const dataResult = await this.pool.query(
      `SELECT * FROM visual_pipelines ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      data: dataResult.rows.map((row) => this.mapRow(row)),
      total,
    };
  }

  /**
   * Update visual pipeline
   */
  async update(tenantId: string, id: string, input: VisualPipelineUpdateInput): Promise<VisualPipeline | null> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      setClauses.push(`name = $${paramIndex++}`);
    }
    if (input.layout !== undefined) {
      params.push(JSON.stringify(input.layout));
      setClauses.push(`layout = $${paramIndex++}`);
    }
    if (input.yamlDefinition !== undefined) {
      params.push(input.yamlDefinition);
      setClauses.push(`yaml_definition = $${paramIndex++}`);
    }

    if (setClauses.length === 0) {
      return this.findById(tenantId, id);
    }

    params.push(id, tenantId);
    setClauses.push(`updated_at = NOW()`);

    const result = await this.pool.query(
      `UPDATE visual_pipelines SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * Delete visual pipeline
   */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM visual_pipelines WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return (result.rowCount || 0) > 0;
  }

  /**
   * Map database row to VisualPipeline
   */
  private mapRow(row: any): VisualPipeline {
    let layout: PipelineLayout = { stages: [], viewport: { x: 0, y: 0, zoom: 1 } };
    try {
      layout = typeof row.layout === 'string' ? JSON.parse(row.layout) : (row.layout || { stages: [], viewport: { x: 0, y: 0, zoom: 1 } });
    } catch {
      layout = { stages: [], viewport: { x: 0, y: 0, zoom: 1 } };
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      pipelineId: row.pipeline_id,
      name: row.name,
      layout,
      yamlDefinition: row.yaml_definition,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}