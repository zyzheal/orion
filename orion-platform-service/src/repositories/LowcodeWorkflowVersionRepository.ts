/**
 * LowcodeWorkflowVersionPgRepository - 低代码工作流版本 PostgreSQL Repository
 *
 * 负责工作流版本快照的持久化操作，继承 BaseRepository 获得标准 CRUD。
 */
import { BaseRepository } from '../../db/base-repository';

export interface LowcodeWorkflowVersionEntity {
  id: string;
  workflow_id: string;
  tenant_id: string;
  version: string;
  nodes: string;
  edges: string;
  commit_message: string;
  created_by: string;
  created_at: Date;
}

export class LowcodeWorkflowVersionPgRepository extends BaseRepository<LowcodeWorkflowVersionEntity> {
  constructor(db: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }) {
    super(db, 'lowcode_workflow_version');
  }

  /**
   * 根据工作流 ID 查找所有版本
   */
  async findByWorkflowId(workflowId: string): Promise<LowcodeWorkflowVersionEntity[]> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_version WHERE workflow_id = $1 ORDER BY created_at DESC`,
      [workflowId],
    );
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * 根据工作流 ID 和版本号查找
   */
  async findByWorkflowIdAndVersion(workflowId: string, version: string): Promise<LowcodeWorkflowVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_version WHERE workflow_id = $1 AND version = $2`,
      [workflowId, version],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 查找工作流的最新版本
   */
  async findLatestVersion(workflowId: string): Promise<LowcodeWorkflowVersionEntity | undefined> {
    const result = await this.db.query(
      `SELECT * FROM lowcode_workflow_version WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [workflowId],
    );
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * 获取工作流版本数量
   */
  async countByWorkflowId(workflowId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM lowcode_workflow_version WHERE workflow_id = $1`,
      [workflowId],
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  protected mapRowToEntity(row: any): LowcodeWorkflowVersionEntity {
    return {
      id: row.id,
      workflow_id: row.workflow_id,
      tenant_id: row.tenant_id,
      version: row.version,
      nodes: typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes || []),
      edges: typeof row.edges === 'string' ? row.edges : JSON.stringify(row.edges || []),
      commit_message: row.commit_message || '',
      created_by: row.created_by,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }
}
