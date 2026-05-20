/**
 * SkillRepository - Database layer for Skill operations
 *
 * Handles PostgreSQL operations for skill packages, instances, versions, and reviews
 */

import { DatabasePool } from '../database';

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  status: string;
  schema: Record<string, any>;
  /** JSON array of capability identifiers (e.g. ["ai.code-gen", "ai.code-review"]) */
  capabilities: string[] | null;
  /** Extended schema definitions for validation */
  schemas: Record<string, any> | null;
  /** When true, prevents further version changes without explicit unlock */
  is_version_locked: boolean;
  install_count: number;
  rating: number;
  rating_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * SkillInstance represents a tenant-specific instance of a skill package.
 * Each instance can have its own configuration overrides.
 */
export interface SkillInstance {
  id: string;
  skill_id: string;
  tenant_id: string;
  project_id: string | null;
  name: string;
  config: Record<string, any>;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SkillVersion {
  id: string;
  skill_id: string;
  version: string;
  changelog: string | null;
  schema: Record<string, any>;
  /** Snapshot of schema at release time */
  schema_snapshot: Record<string, any> | null;
  is_latest: boolean;
  /** When true, this version cannot be modified */
  is_locked: boolean;
  /** Timestamp when version was released */
  released_at: Date | null;
  created_at: Date;
}

export interface SkillReview {
  id: string;
  skill_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

export interface CreateSkillInput {
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
  author: string;
  schema?: Record<string, any>;
  capabilities?: string[];
  schemas?: Record<string, any>;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: string;
  schema?: Record<string, any>;
  capabilities?: string[];
  schemas?: Record<string, any>;
  is_version_locked?: boolean;
}

export interface CreateSkillVersionInput {
  skill_id: string;
  version: string;
  changelog?: string;
  schema?: Record<string, any>;
  schema_snapshot?: Record<string, any>;
  is_locked?: boolean;
}

export interface CreateSkillReviewInput {
  skill_id: string;
  user_id: string;
  rating: number;
  comment?: string;
}

export interface CreateInstanceInput {
  skill_id: string;
  tenant_id: string;
  project_id?: string;
  name: string;
  config?: Record<string, any>;
  is_default?: boolean;
}

export interface UpdateInstanceInput {
  name?: string;
  config?: Record<string, any>;
  is_default?: boolean;
  project_id?: string;
}

interface FindAllOptions {
  status?: string;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export class SkillRepository {
  constructor(private pool: DatabasePool) {}


  // ==================== Skill Packages ====================

  /**
   * Find skill by ID
   */
  async findById(id: string): Promise<SkillPackage | null> {
    const result = await this.pool.query(
      'SELECT * FROM skill_packages WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find skill by name
   */
  async findByName(name: string): Promise<SkillPackage | null> {
    const result = await this.pool.query(
      'SELECT * FROM skill_packages WHERE name = $1',
      [name]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all skills with filtering
   */
  async findAll(options?: FindAllOptions): Promise<SkillPackage[]> {
    let query = 'SELECT * FROM skill_packages';
    const params: any[] = [];
    const conditions: string[] = [];

    if (options?.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }

    if (options?.category) {
      params.push(options.category);
      conditions.push(`category = $${params.length}`);
    }

    if (options?.tags && options.tags.length > 0) {
      params.push(options.tags);
      conditions.push(`tags && $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY install_count DESC, rating DESC';

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
   * Count skills
   */
  async count(options?: { status?: string; category?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM skill_packages';
    const params: any[] = [];

    if (options?.status || options?.category) {
      const conditions: string[] = [];
      if (options?.status) {
        params.push(options.status);
        conditions.push(`status = $1`);
      }
      if (options?.category) {
        params.push(options.category);
        conditions.push(`category = $${params.length}`);
      }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Create a new skill
   */
  async create(input: CreateSkillInput): Promise<SkillPackage> {
    const { name, version, description, category, tags, author, schema, capabilities, schemas } = input;

    const result = await this.pool.query(
      `INSERT INTO skill_packages (name, version, description, category, tags, author, status, schema, capabilities, schemas)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9)
       RETURNING *`,
      [name, version, description, category, tags || [], author, schema || {}, capabilities || null, schemas || null]
    );

    return result.rows[0];
  }

  /**
   * Update skill
   */
  async update(id: string, input: UpdateSkillInput): Promise<SkillPackage | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }

    if (input.description !== undefined) {
      params.push(input.description);
      updates.push(`description = $${paramIndex++}`);
    }

    if (input.category !== undefined) {
      params.push(input.category);
      updates.push(`category = $${paramIndex++}`);
    }

    if (input.tags !== undefined) {
      params.push(input.tags);
      updates.push(`tags = $${paramIndex++}`);
    }

    if (input.status !== undefined) {
      params.push(input.status);
      updates.push(`status = $${paramIndex++}`);
    }

    if (input.schema !== undefined) {
      params.push(JSON.stringify(input.schema));
      updates.push(`schema = $${paramIndex++}`);
    }

    if (input.capabilities !== undefined) {
      params.push(input.capabilities);
      updates.push(`capabilities = $${paramIndex++}`);
    }

    if (input.schemas !== undefined) {
      params.push(JSON.stringify(input.schemas));
      updates.push(`schemas = $${paramIndex++}`);
    }

    if (input.is_version_locked !== undefined) {
      params.push(input.is_version_locked);
      updates.push(`is_version_locked = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE skill_packages SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Delete skill (soft delete)
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      "UPDATE skill_packages SET status = 'uninstalled', updated_at = NOW() WHERE id = $1",
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Increment install count
   */
  async incrementInstallCount(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE skill_packages SET install_count = install_count + 1 WHERE id = $1',
      [id]
    );
  }

  // ==================== Skill Versions ====================

  /**
   * Find versions by skill ID
   */
  async findVersions(skillId: string): Promise<SkillVersion[]> {
    const result = await this.pool.query(
      'SELECT * FROM skill_versions WHERE skill_id = $1 ORDER BY created_at DESC',
      [skillId]
    );
    return result.rows;
  }

  /**
   * Find latest version
   */
  async findLatestVersion(skillId: string): Promise<SkillVersion | null> {
    const result = await this.pool.query(
      'SELECT * FROM skill_versions WHERE skill_id = $1 AND is_latest = true LIMIT 1',
      [skillId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create skill version
   */
  async createVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    const { skill_id, version, changelog, schema, schema_snapshot, is_locked } = input;

    // Clear previous latest flag
    await this.pool.query(
      'UPDATE skill_versions SET is_latest = false WHERE skill_id = $1',
      [skill_id]
    );

    const result = await this.pool.query(
      `INSERT INTO skill_versions (skill_id, version, changelog, schema, schema_snapshot, is_latest, is_locked, released_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
       RETURNING *`,
      [skill_id, version, changelog || null, schema || {}, schema_snapshot || null, is_locked || false]
    );

    // Update skill package version
    await this.pool.query(
      'UPDATE skill_packages SET version = $1, updated_at = NOW() WHERE id = $2',
      [version, skill_id]
    );

    return result.rows[0];
  }

  // ==================== Skill Reviews ====================

  /**
   * Find reviews by skill ID
   */
  async findReviews(skillId: string): Promise<SkillReview[]> {
    const result = await this.pool.query(
      'SELECT * FROM skill_reviews WHERE skill_id = $1 ORDER BY created_at DESC',
      [skillId]
    );
    return result.rows;
  }

  /**
   * Create skill review
   */
  async createReview(input: CreateSkillReviewInput): Promise<SkillReview> {
    const { skill_id, user_id, rating, comment } = input;
    
    const result = await this.pool.query(
      `INSERT INTO skill_reviews (skill_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (skill_id, user_id) DO UPDATE SET rating = $3, comment = $4
       RETURNING *`,
      [skill_id, user_id, rating, comment || null]
    );
    
    // Update skill rating
    await this.updateSkillRating(skill_id);
    
    return result.rows[0];
  }

  /**
   * Update skill rating
   */
  private async updateSkillRating(skillId: string): Promise<void> {
    await this.pool.query(
      `UPDATE skill_packages SET 
         rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM skill_reviews WHERE skill_id = $1),
         rating_count = (SELECT COUNT(*) FROM skill_reviews WHERE skill_id = $1),
         updated_at = NOW()
       WHERE id = $1`,
      [skillId]
    );
  }

  // ==================== Skill Instances ====================

  /**
   * Create a new skill instance for a tenant
   */
  async createInstance(input: CreateInstanceInput): Promise<SkillInstance> {
    const { skill_id, tenant_id, project_id, name, config, is_default } = input;

    const result = await this.pool.query(
      `INSERT INTO skill_instances (skill_id, tenant_id, project_id, name, config, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [skill_id, tenant_id, project_id || null, name, config || {}, is_default || false]
    );

    return result.rows[0];
  }

  /**
   * Get skill instance by ID
   */
  async findInstanceById(id: string): Promise<SkillInstance | null> {
    const result = await this.pool.query(
      'SELECT * FROM skill_instances WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get skill instance by ID scoped to tenant
   */
  async findInstanceByIdAndTenant(id: string, tenantId: string): Promise<SkillInstance | null> {
    const result = await this.pool.query(
      'SELECT * FROM skill_instances WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all instances for a skill within a tenant
   */
  async findInstancesBySkillId(skillId: string, tenantId: string): Promise<SkillInstance[]> {
    const result = await this.pool.query(
      'SELECT * FROM skill_instances WHERE skill_id = $1 AND tenant_id = $2 ORDER BY is_default DESC, name',
      [skillId, tenantId]
    );
    return result.rows;
  }

  /**
   * Get all instances for a tenant (across all skills)
   */
  async findInstancesByTenant(tenantId: string, limit: number = 50, offset: number = 0): Promise<{ instances: SkillInstance[]; total: number }> {
    const countResult = await this.pool.query(
      'SELECT COUNT(*) FROM skill_instances WHERE tenant_id = $1',
      [tenantId]
    );

    const result = await this.pool.query(
      `SELECT * FROM skill_instances
       WHERE tenant_id = $1
       ORDER BY is_default DESC, updated_at DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
    );

    return {
      instances: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Update a skill instance
   */
  async updateInstance(id: string, input: UpdateInstanceInput): Promise<SkillInstance | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      params.push(input.name);
      updates.push(`name = $${paramIndex++}`);
    }

    if (input.config !== undefined) {
      params.push(JSON.stringify(input.config));
      updates.push(`config = $${paramIndex++}`);
    }

    if (input.is_default !== undefined) {
      params.push(input.is_default);
      updates.push(`is_default = $${paramIndex++}`);
    }

    if (input.project_id !== undefined) {
      params.push(input.project_id);
      updates.push(`project_id = $${paramIndex++}`);
    }

    if (updates.length === 0) {
      return this.findInstanceById(id);
    }

    params.push(id);

    const result = await this.pool.query(
      `UPDATE skill_instances SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a skill instance
   */
  async deleteInstance(id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM skill_instances WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  /**
   * Lock a skill version (prevent modifications)
   */
  async lockVersion(versionId: string): Promise<SkillVersion | null> {
    const result = await this.pool.query(
      `UPDATE skill_versions SET is_locked = true, released_at = COALESCE(released_at, NOW())
       WHERE id = $1
       RETURNING *`,
      [versionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Unlock a skill version (allow modifications again)
   */
  async unlockVersion(versionId: string): Promise<SkillVersion | null> {
    const result = await this.pool.query(
      `UPDATE skill_versions SET is_locked = false
       WHERE id = $1
       RETURNING *`,
      [versionId]
    );
    return result.rows[0] || null;
  }

  // ==================== Search ====================

  /**
   * Search skills by name or description
   */
  async search(query: string, limit: number = 20): Promise<SkillPackage[]> {
    const result = await this.pool.query(
      `SELECT * FROM skill_packages 
       WHERE status = 'published' 
         AND (name ILIKE $1 OR description ILIKE $1)
       ORDER BY install_count DESC, rating DESC
       LIMIT $2`,
      [`%${query}%`, limit]
    );
    return result.rows;
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    const result = await this.pool.query(
      `SELECT category, COUNT(*) as count 
       FROM skill_packages 
       WHERE status = 'published'
       GROUP BY category 
       ORDER BY count DESC`
    );
    return result.rows;
  }
}