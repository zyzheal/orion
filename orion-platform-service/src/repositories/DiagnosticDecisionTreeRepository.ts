/**
 * DiagnosticDecisionTreeRepository
 * Data access layer for decision tree nodes.
 * Replaces in-memory Map<string, DecisionTreeNode> in DiagnosticDecisionTree.
 */

import { ErrorCode } from '../errors';
import { BaseRepository } from '../db/base-repository';
import { OrionError } from '../errors';
import { DecisionBranch, DecisionTreeNode } from '../services/diagnostic/DiagnosticDecisionTree';
import { RootCause } from '../services/diagnostic/types';

export interface DiagnosticDecisionTreeNodeEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  isLeaf: boolean;
  branches: DecisionBranch[];
  rootCause?: RootCause;
  defaultBranch?: DecisionBranch;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DiagnosticDecisionTreeRepository extends BaseRepository<DiagnosticDecisionTreeNodeEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'diagnostic_decision_tree_nodes');
  }

  async create(data: any): Promise<DiagnosticDecisionTreeNodeEntity> {
    const columns = ['id', 'tenant_id', 'name', 'description', 'is_leaf', 'branches'];
    const values: any[] = [
      data.id,
      data.tenantId || 'default',
      data.name,
      data.description || '',
      data.isLeaf || false,
      JSON.stringify(data.branches || []),
    ];

    if (data.rootCause !== undefined) {
      columns.push('root_cause');
      values.push(JSON.stringify(data.rootCause));
    }
    if (data.defaultBranch !== undefined) {
      columns.push('default_branch');
      values.push(JSON.stringify(data.defaultBranch));
    }
    if (data.parentId) {
      columns.push('parent_id');
      values.push(data.parentId);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.db.query(query, values);

    if (result.rows.length === 0) {
      throw new OrionError('OPERATION_FAILED', ErrorCode.DATABASE_ERROR);
    }
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByTenant(tenantId: string): Promise<DiagnosticDecisionTreeNodeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findLeafNodes(tenantId?: string): Promise<DiagnosticDecisionTreeNodeEntity[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE is_leaf = TRUE`;
    const params: any[] = [];
    if (tenantId) {
      query += ` AND tenant_id = $1`;
      params.push(tenantId);
    }
    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByParentId(parentId: string): Promise<DiagnosticDecisionTreeNodeEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE parent_id = $1`,
      [parentId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  protected mapRowToEntity(row: any): DiagnosticDecisionTreeNodeEntity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      isLeaf: row.is_leaf,
      branches: (row.branches || []) as DecisionBranch[],
      rootCause: row.root_cause ? (typeof row.root_cause === 'string' ? JSON.parse(row.root_cause) : row.root_cause) as RootCause : undefined,
      defaultBranch: row.default_branch ? (typeof row.default_branch === 'string' ? JSON.parse(row.default_branch) : row.default_branch) as DecisionBranch : undefined,
      parentId: row.parent_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
