/**
 * DataLineageRepository - PostgreSQL persistence for data lineage
 *
 * Manages lineage nodes, edges, and execution records with tenant isolation.
 */

import { BaseRepository } from '../../db/base-repository';

// ==================== Entities ====================

export interface LineageNodeEntity {
  id: string;
  tenantId: string;
  name: string;
  type: 'source' | 'transform' | 'sink' | 'dataset' | 'model';
  description: string | null;
  pipelineId: string | null;
  stageId: string | null;
  schema: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LineageEdgeEntity {
  id: string;
  tenantId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: 'produces' | 'consumes' | 'transforms' | 'derives';
  fieldMapping: Record<string, string> | null;
  createdAt: Date;
}

export interface LineageRecordEntity {
  id: string;
  tenantId: string;
  pipelineId: string;
  executionId: string;
  nodeIds: string[];
  edgeIds: string[];
  recordedAt: Date;
}

// ==================== Repository ====================

export class LineageNodeRepository extends BaseRepository<LineageNodeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'data_lineage_nodes');
  }

  /**
   * Find all nodes for a tenant with optional filters
   */
  async findByTenant(
    tenantId: string,
    filters?: { type?: string; pipelineId?: string; search?: string },
  ): Promise<LineageNodeEntity[]> {
    let query = `SELECT * FROM data_lineage_nodes WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.pipelineId) {
      query += ` AND pipeline_id = $${paramIndex}`;
      params.push(filters.pipelineId);
      paramIndex++;
    }

    if (filters?.search) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find nodes by pipeline ID
   */
  async findByPipeline(pipelineId: string, tenantId: string): Promise<LineageNodeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM data_lineage_nodes WHERE pipeline_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [pipelineId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): LineageNodeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      type: row.type,
      description: row.description ?? null,
      pipelineId: row.pipeline_id ?? null,
      stageId: row.stage_id ?? null,
      schema: row.schema_data ?? null,
      metadata: row.node_metadata ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class LineageEdgeRepository extends BaseRepository<LineageEdgeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'data_lineage_edges');
  }

  /**
   * Find edges by tenant with optional node filter
   */
  async findByTenant(
    tenantId: string,
    filters?: { fromNodeId?: string; toNodeId?: string },
  ): Promise<LineageEdgeEntity[]> {
    let query = `SELECT * FROM data_lineage_edges WHERE tenant_id = $1`;
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.fromNodeId) {
      query += ` AND from_node_id = $${paramIndex}`;
      params.push(filters.fromNodeId);
      paramIndex++;
    }

    if (filters?.toNodeId) {
      query += ` AND to_node_id = $${paramIndex}`;
      params.push(filters.toNodeId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find upstream edges (edges where toNodeId is the target)
   */
  async findUpstream(nodeId: string, tenantId: string): Promise<LineageEdgeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM data_lineage_edges WHERE to_node_id = $1 AND tenant_id = $2`,
      [nodeId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find downstream edges (edges where fromNodeId is the source)
   */
  async findDownstream(nodeId: string, tenantId: string): Promise<LineageEdgeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM data_lineage_edges WHERE from_node_id = $1 AND tenant_id = $2`,
      [nodeId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find edges by pipeline ID
   */
  async findByPipeline(pipelineId: string, tenantId: string): Promise<LineageEdgeEntity[]> {
    const result = await this.db.query(
      `SELECT e.* FROM data_lineage_edges e
       JOIN data_lineage_nodes n ON e.from_node_id = n.id
       WHERE n.pipeline_id = $1 AND e.tenant_id = $2`,
      [pipelineId, tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): LineageEdgeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fromNodeId: row.from_node_id,
      toNodeId: row.to_node_id,
      relationship: row.relationship,
      fieldMapping: row.field_mapping ?? null,
      createdAt: row.created_at,
    };
  }
}

export class LineageRecordRepository extends BaseRepository<LineageRecordEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'data_lineage_records');
  }

  /**
   * Find records by pipeline ID
   */
  async findByPipeline(
    pipelineId: string,
    tenantId: string,
    limit: number = 20,
  ): Promise<LineageRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM data_lineage_records
       WHERE pipeline_id = $1 AND tenant_id = $2
       ORDER BY recorded_at DESC
       LIMIT $3`,
      [pipelineId, tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Find latest record by pipeline ID
   */
  async findLatestByPipeline(pipelineId: string, tenantId: string): Promise<LineageRecordEntity | null> {
    const result = await this.db.query(
      `SELECT * FROM data_lineage_records
       WHERE pipeline_id = $1 AND tenant_id = $2
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [pipelineId, tenantId],
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /**
   * Find all records for a tenant
   */
  async findByTenant(tenantId: string, limit: number = 50): Promise<LineageRecordEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM data_lineage_records
       WHERE tenant_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): LineageRecordEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      pipelineId: row.pipeline_id,
      executionId: row.execution_id,
      nodeIds: row.node_ids ?? [],
      edgeIds: row.edge_ids ?? [],
      recordedAt: row.recorded_at,
    };
  }
}
