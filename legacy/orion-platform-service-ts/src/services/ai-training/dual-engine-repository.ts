import { DatabasePool } from '../database';
import {
  DualEngineConfig,
  DualEngineStatus,
  AstAnalysisConfig,
  LlmParsingConfig,
} from './dual-engine-model';

export class DualEngineRepository {
  constructor(private pool: DatabasePool) {}

  /**
   * 创建双引擎配置
   */
  async create(
    tenantId: string,
    name: string,
    description: string,
    astConfig: AstAnalysisConfig,
    llmConfig: LlmParsingConfig
  ): Promise<DualEngineConfig> {
    const id = `de-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO dual_engines (id, tenant_id, name, description, ast_config, llm_config, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, tenantId, name, description, JSON.stringify(astConfig), JSON.stringify(llmConfig), 'active', now, now]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * 根据 ID 查找双引擎配置
   */
  async findById(id: string): Promise<DualEngineConfig | null> {
    const result = await this.pool.query(
      'SELECT * FROM dual_engines WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * 获取租户下所有双引擎配置
   */
  async findAll(tenantId: string): Promise<DualEngineConfig[]> {
    const result = await this.pool.query(
      'SELECT * FROM dual_engines WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  /**
   * 更新双引擎配置
   */
  async update(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      astConfig: AstAnalysisConfig;
      llmConfig: LlmParsingConfig;
      status: 'active' | 'inactive' | 'error';
    }>
  ): Promise<DualEngineConfig | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.astConfig !== undefined) {
      setClauses.push(`ast_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.astConfig));
    }
    if (updates.llmConfig !== undefined) {
      setClauses.push(`llm_config = $${paramIndex++}`);
      values.push(JSON.stringify(updates.llmConfig));
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(id);

    const result = await this.pool.query(
      `UPDATE dual_engines SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  /**
   * 删除双引擎配置
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM dual_engines WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * 获取双引擎运行状态
   */
  async getStatus(engineId: string): Promise<DualEngineStatus | null> {
    const result = await this.pool.query(
      'SELECT * FROM dual_engine_status WHERE engine_id = $1',
      [engineId]
    );
    return result.rows[0] ? this.mapStatusRow(result.rows[0]) : null;
  }

  /**
   * 更新双引擎运行状态
   */
  async updateStatus(
    engineId: string,
    status: Partial<DualEngineStatus>
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status.astStatus !== undefined) {
      setClauses.push(`ast_status = $${paramIndex++}`);
      values.push(status.astStatus);
    }
    if (status.llmStatus !== undefined) {
      setClauses.push(`llm_status = $${paramIndex++}`);
      values.push(status.llmStatus);
    }
    if (status.currentProcessingFiles !== undefined) {
      setClauses.push(`current_processing_files = $${paramIndex++}`);
      values.push(status.currentProcessingFiles);
    }
    if (status.processedFiles !== undefined) {
      setClauses.push(`processed_files = $${paramIndex++}`);
      values.push(status.processedFiles);
    }
    if (status.errorFiles !== undefined) {
      setClauses.push(`error_files = $${paramIndex++}`);
      values.push(status.errorFiles);
    }

    setClauses.push(`last_updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(engineId);

    await this.pool.query(
      `UPDATE dual_engine_status SET ${setClauses.join(', ')} WHERE engine_id = $${paramIndex}`,
      values
    );
  }

  /**
   * 映射数据库行为 DualEngineConfig
   */
  private mapRow(row: any): DualEngineConfig {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      astConfig: typeof row.ast_config === 'string' ? JSON.parse(row.ast_config) : row.ast_config,
      llmConfig: typeof row.llm_config === 'string' ? JSON.parse(row.llm_config) : row.llm_config,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * 映射数据库行为 DualEngineStatus
   */
  private mapStatusRow(row: any): DualEngineStatus {
    return {
      engineId: row.engine_id,
      astStatus: row.ast_status,
      llmStatus: row.llm_status,
      currentProcessingFiles: row.current_processing_files,
      processedFiles: row.processed_files,
      errorFiles: row.error_files,
      lastUpdatedAt: new Date(row.last_updated_at),
    };
  }
}
