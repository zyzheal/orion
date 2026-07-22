import { DatabasePool } from '../utils/database';
/**
 * BuildRepository - Database layer for Build operations
 * 
 * Handles PostgreSQL operations for build environments and build records
 */


export interface BuildEnvironment {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  image: string;
  description: string | null;
  config: Record<string, any>;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Build {
  id: string;
  tenant_id: string;
  project_id: string | null;
  pipeline_run_id: string | null;
  image: string | null;
  tag: string | null;
  status: string;
  source_ref: string | null;
  build_args: Record<string, any>;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: Date;
}

export interface CreateBuildInput {
  tenant_id: string;
  project_id?: string;
  pipeline_run_id?: string;
  image?: string;
  tag?: string;
  source_ref?: string;
  build_args?: Record<string, any>;
}

export interface CreateBuildEnvironmentInput {
  tenant_id: string;
  name: string;
  type: string;
  image: string;
  description?: string;
  config?: Record<string, any>;
}

export interface UpdateBuildInput {
  status?: string;
  image?: string;
  tag?: string;
  error_message?: string;
}

interface FindAllOptions {
  tenantId?: string;
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export class BuildRepository {
  constructor(private pool: DatabasePool) {}


  // ==================== Build Environments ====================

  /**
   * Find environment by ID
   */
  async findEnvironmentById(id: string): Promise<BuildEnvironment | null> {
    const result = await this.pool.query(
      'SELECT * FROM build_environments WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all environments
   */
  async findAllEnvironments(tenantId?: string): Promise<BuildEnvironment[]> {
    let query = 'SELECT * FROM build_environments';
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      query += ' WHERE tenant_id = $1';
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Create build environment
   */
  async createEnvironment(input: CreateBuildEnvironmentInput): Promise<BuildEnvironment> {
    const { tenant_id, name, type, image, description, config } = input;
    
    const result = await this.pool.query(
      `INSERT INTO build_environments (tenant_id, name, type, image, description, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, name, type, image, description || null, config || {}]
    );
    
    return result.rows[0];
  }

  /**
   * Update build environment
   */
  async updateEnvironment(id: string, input: Partial<CreateBuildEnvironmentInput & { status?: string }>): Promise<BuildEnvironment | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }

    if (input.image !== undefined) {
      params.push(input.image);
      updates.push(`image = $${paramIndex++}`);
    }

    if (input.description !== undefined) {
      params.push(input.description);
      updates.push(`description = $${paramIndex++}`);
    }

    if (input.config !== undefined) {
      params.push(JSON.stringify(input.config));
      updates.push(`config = $${paramIndex++}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findEnvironmentById(id);
    }

    params.push(id);
    
    const result = await this.pool.query(
      `UPDATE build_environments SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Delete environment (soft delete)
   */
  async deleteEnvironment(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE build_environments SET status = 'deleted', updated_at = NOW() WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== Builds ====================

  /**
   * Find build by ID
   */
  async findById(id: string): Promise<Build | null> {
    const result = await this.pool.query(
      'SELECT * FROM builds WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all builds with filtering
   */
  async findAll(options?: FindAllOptions): Promise<Build[]> {
    let query = 'SELECT * FROM builds';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.tenantId) {
      params.push(options.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }

    if (options?.projectId) {
      params.push(options.projectId);
      conditions.push(`project_id = $${params.length}`);
    }

    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Count builds
   */
  async count(options?: { tenantId?: string; status?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM builds';
    const params: any[] = [];

    if (options?.tenantId) {
      params.push(options.tenantId);
      query += ' WHERE tenant_id = $1';
      
      if (options?.status) {
        params.push(options.status);
        query += ' AND status = $2';
      }
    } else if (options?.status) {
      params.push(options.status);
      query += ' WHERE status = $1';
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new build
   */
  async create(input: CreateBuildInput): Promise<Build> {
    const { tenant_id, project_id, pipeline_run_id, image, tag, source_ref, build_args } = input;
    
    const result = await this.pool.query(
      `INSERT INTO builds (tenant_id, project_id, pipeline_run_id, image, tag, source_ref, build_args, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [tenant_id, project_id || null, pipeline_run_id || null, image || null, tag || null, source_ref || null, build_args || {}]
    );
    
    return result.rows[0];
  }

  /**
   * Update build
   */
  async update(id: string, input: UpdateBuildInput): Promise<Build | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (input.image !== undefined) {
      params.push(input.image);
      updates.push(`image = $${paramIndex++}`);
    }

    if (input.tag !== undefined) {
      params.push(input.tag);
      updates.push(`tag = $${paramIndex++}`);
    }

    if (input.error_message !== undefined) {
      params.push(input.error_message);
      updates.push(`error_message = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);
    
    const result = await this.pool.query(
      `UPDATE builds SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Start build (set status to running)
   */
  async startBuild(id: string): Promise<Build | null> {
    const result = await this.pool.query(
      `UPDATE builds SET status = 'running', started_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Complete build (success or failure)
   */
  async completeBuild(id: string, status: string, errorMessage?: string): Promise<Build | null> {
    const result = await this.pool.query(
      `UPDATE builds SET 
         status = $1, 
         completed_at = NOW(), 
         duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at))::BIGINT * 1000,
         error_message = $2
       WHERE id = $3 
       RETURNING *`,
      [status, errorMessage || null, id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get build by pipeline run
   */
  async findByPipelineRun(pipelineRunId: string): Promise<Build | null> {
    const result = await this.pool.query(
      'SELECT * FROM builds WHERE pipeline_run_id = $1 ORDER BY created_at DESC LIMIT 1',
      [pipelineRunId]
    );
    return result.rows[0] || null;
  }

  // ==================== Stats ====================

  /**
   * Get build statistics
   */
  async getBuildStats(tenantId?: string): Promise<{
    total: number;
    success: number;
    failed: number;
    running: number;
    pending: number;
    avgDuration: number;
  }> {
    let query = `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      AVG(duration_ms) as avg_duration
     FROM builds`;
    const params: any[] = [];

    if (tenantId) {
      params.push(tenantId);
      query += ' WHERE tenant_id = $1';
    }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    return {
      total: parseInt(row.total || '0', 10),
      success: parseInt(row.success || '0', 10),
      failed: parseInt(row.failed || '0', 10),
      running: parseInt(row.running || '0', 10),
      pending: parseInt(row.pending || '0', 10),
      avgDuration: parseFloat(row.avg_duration || '0'),
    };
  }
}