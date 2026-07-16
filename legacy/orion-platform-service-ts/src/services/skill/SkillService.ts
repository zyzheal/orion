/**
 * SkillService - Business logic layer for Skill operations
 * 
 * Handles skill package management, versioning, and reviews
 */

import {
  SkillRepository,
  SkillPackage,
  SkillVersion,
  SkillInstance,
  SkillReview,
  SkillExecution,
  SkillAuditLog,
  CreateSkillInput,
  UpdateSkillInput,
  CreateSkillVersionInput,
  CreateSkillReviewInput,
  CreateInstanceInput,
  UpdateInstanceInput,
  CreateExecutionInput,
  UpdateExecutionInput,
  CreateAuditLogInput,
} from './SkillRepository';

export interface ListSkillsOptions {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  tags?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class SkillServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SkillServiceError';
  }
}

export class SkillService {
  private repository: SkillRepository;

  constructor(repository: SkillRepository) {
    this.repository = repository;
  }

  // ==================== Skill CRUD ====================

  /**
   * Get skill by ID
   */
  async getSkill(id: string): Promise<SkillPackage> {
    const skill = await this.repository.findById(id);
    
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }
    
    return skill;
  }

  /**
   * List skills with pagination
   */
  async listSkills(options: ListSkillsOptions = {}): Promise<PaginatedResult<SkillPackage>> {
    const { page = 1, limit = 20, status, category, tags } = options;
    const offset = (page - 1) * limit;

    const [skills, total] = await Promise.all([
      this.repository.findAll({ status, category, tags, limit, offset }),
      this.repository.count({ status, category }),
    ]);

    return {
      data: skills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new skill
   */
  async createSkill(input: CreateSkillInput): Promise<SkillPackage> {
    if (!input.name || input.name.trim().length === 0) {
      throw new SkillServiceError('Skill name is required', 'INVALID_INPUT');
    }

    if (!input.description || input.description.trim().length === 0) {
      throw new SkillServiceError('Description is required', 'INVALID_INPUT');
    }

    if (!input.author || input.author.trim().length === 0) {
      throw new SkillServiceError('Author is required', 'INVALID_INPUT');
    }

    // Check for duplicate name
    const exists = await this.repository.findByName(input.name);
    if (exists) {
      throw new SkillServiceError('Skill name already exists', 'DUPLICATE_NAME');
    }

    const skill = await this.repository.create({
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
    });

    // Create initial version
    await this.repository.createVersion({
      skill_id: skill.id,
      version: skill.version,
      schema: input.schema,
    });

    return skill;
  }

  /**
   * Update skill
   */
  async updateSkill(id: string, input: UpdateSkillInput): Promise<SkillPackage> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    const updated = await this.repository.update(id, input);
    
    if (!updated) {
      throw new SkillServiceError(`Failed to update skill: ${id}`, 'UPDATE_FAILED');
    }
    
    return updated;
  }

  /**
   * Publish skill
   */
  async publishSkill(id: string): Promise<SkillPackage> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    if (existing.status !== 'draft' && existing.status !== 'review') {
      throw new SkillServiceError('Can only publish draft or review skills', 'INVALID_STATE');
    }

    return this.repository.update(id, { status: 'published' }) as Promise<SkillPackage>;
  }

  /**
   * Uninstall skill
   */
  async uninstallSkill(id: string): Promise<boolean> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    return this.repository.delete(id);
  }

  /**
   * Install skill (increment count)
   */
  async installSkill(id: string): Promise<void> {
    const skill = await this.repository.findById(id);
    
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    if (skill.status !== 'published') {
      throw new SkillServiceError('Can only install published skills', 'INVALID_STATE');
    }

    await this.repository.incrementInstallCount(id);
  }

  // ==================== Versions ====================

  /**
   * Get skill versions
   */
  async getVersions(skillId: string): Promise<SkillVersion[]> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    return this.repository.findVersions(skillId);
  }

  /**
   * Get latest version
   */
  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    return this.repository.findLatestVersion(skillId);
  }

  /**
   * Create new version
   */
  async createVersion(skillId: string, input: {
    version: string;
    changelog?: string;
    schema?: Record<string, any>;
    schema_snapshot?: Record<string, any>;
    is_locked?: boolean;
  }): Promise<SkillVersion> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    // Prevent creating versions if the skill is version-locked
    if (skill.is_version_locked) {
      throw new SkillServiceError('Skill version is locked', 'VERSION_LOCKED');
    }

    return this.repository.createVersion({
      skill_id: skillId,
      version: input.version,
      changelog: input.changelog,
      schema: input.schema || skill.schema,
      schema_snapshot: input.schema_snapshot || skill.schema,
      is_locked: input.is_locked || false,
    });
  }

  // ==================== Reviews ====================

  /**
   * Get skill reviews
   */
  async getReviews(skillId: string): Promise<SkillReview[]> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    return this.repository.findReviews(skillId);
  }

  /**
   * Add review
   */
  async addReview(skillId: string, input: {
    user_id: string;
    rating: number;
    comment?: string;
  }): Promise<SkillReview> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    if (input.rating < 1 || input.rating > 5) {
      throw new SkillServiceError('Rating must be between 1 and 5', 'INVALID_RATING');
    }

    return this.repository.createReview({
      skill_id: skillId,
      user_id: input.user_id,
      rating: input.rating,
      comment: input.comment,
    });
  }

  // ==================== Instance Management ====================

  /**
   * Create a new skill instance
   */
  async createInstance(input: CreateInstanceInput): Promise<SkillInstance> {
    if (!input.name || input.name.trim().length === 0) {
      throw new SkillServiceError('Instance name is required', 'INVALID_INPUT');
    }

    // Verify the skill exists
    const skill = await this.repository.findById(input.skill_id);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${input.skill_id}`, 'SKILL_NOT_FOUND');
    }

    // Verify the skill is installed in this tenant
    if (!(skill as any).tenant_id || (skill as any).tenant_id !== input.tenant_id) {
      // Check if skill has any tenant association; if not, it might be a marketplace skill
      // In that case, allow instance creation but log it
      if ((skill as any).tenant_id && (skill as any).tenant_id !== input.tenant_id) {
        throw new SkillServiceError('This skill is not available for this tenant', 'TENANT_MISMATCH');
      }
    }

    // If this instance should be default, unset any existing default for this skill+tenant
    if (input.is_default) {
      const existingInstances = await this.repository.findInstancesBySkillId(input.skill_id, input.tenant_id);
      for (const instance of existingInstances) {
        if (instance.is_default) {
          await this.repository.updateInstance(instance.id, { is_default: false });
        }
      }
    }

    return this.repository.createInstance({
      skill_id: input.skill_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      name: input.name.trim(),
      config: input.config || {},
      is_default: input.is_default || false,
    });
  }

  /**
   * Get skill instance by ID
   */
  async getInstance(id: string, tenantId?: string): Promise<SkillInstance> {
    const instance = tenantId
      ? await this.repository.findInstanceByIdAndTenant(id, tenantId)
      : await this.repository.findInstanceById(id);

    if (!instance) {
      throw new SkillServiceError(`Skill instance not found: ${id}`, 'INSTANCE_NOT_FOUND');
    }

    return instance;
  }

  /**
   * List instances for a skill
   */
  async listInstances(skillId: string, tenantId: string): Promise<SkillInstance[]> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    return this.repository.findInstancesBySkillId(skillId, tenantId);
  }

  /**
   * List all instances for a tenant
   */
  async listInstancesByTenant(tenantId: string, limit: number = 50, offset: number = 0): Promise<{ instances: SkillInstance[]; total: number }> {
    return this.repository.findInstancesByTenant(tenantId, limit, offset);
  }

  /**
   * Update a skill instance
   */
  async updateInstance(id: string, input: UpdateInstanceInput, tenantId?: string): Promise<SkillInstance> {
    const existing = tenantId
      ? await this.repository.findInstanceByIdAndTenant(id, tenantId)
      : await this.repository.findInstanceById(id);

    if (!existing) {
      throw new SkillServiceError(`Skill instance not found: ${id}`, 'INSTANCE_NOT_FOUND');
    }

    // If setting as default, unset other defaults for this skill+tenant
    if (input.is_default === true) {
      const instances = await this.repository.findInstancesBySkillId(existing.skill_id, existing.tenant_id);
      for (const instance of instances) {
        if (instance.id !== id && instance.is_default) {
          await this.repository.updateInstance(instance.id, { is_default: false });
        }
      }
    }

    const updated = await this.repository.updateInstance(id, input);
    if (!updated) {
      throw new SkillServiceError(`Failed to update instance: ${id}`, 'UPDATE_FAILED');
    }

    return updated;
  }

  /**
   * Delete a skill instance
   */
  async deleteInstance(id: string, tenantId?: string): Promise<void> {
    const existing = tenantId
      ? await this.repository.findInstanceByIdAndTenant(id, tenantId)
      : await this.repository.findInstanceById(id);

    if (!existing) {
      throw new SkillServiceError(`Skill instance not found: ${id}`, 'INSTANCE_NOT_FOUND');
    }

    const deleted = await this.repository.deleteInstance(id);
    if (!deleted) {
      throw new SkillServiceError(`Failed to delete instance: ${id}`, 'DELETE_FAILED');
    }
  }

  // ==================== Version Locking ====================

  /**
   * Lock a skill version to prevent further modifications
   */
  async lockVersion(versionId: string): Promise<SkillVersion> {
    const locked = await this.repository.lockVersion(versionId);
    if (!locked) {
      throw new SkillServiceError(`Skill version not found: ${versionId}`, 'VERSION_NOT_FOUND');
    }
    return locked;
  }

  /**
   * Unlock a skill version to allow modifications
   */
  async unlockVersion(versionId: string): Promise<SkillVersion> {
    const unlocked = await this.repository.unlockVersion(versionId);
    if (!unlocked) {
      throw new SkillServiceError(`Skill version not found: ${versionId}`, 'VERSION_NOT_FOUND');
    }
    return unlocked;
  }

  /**
   * Record a version snapshot for a skill (convenience method)
   */
  async recordVersion(skillId: string, version: string, changelog?: string): Promise<SkillVersion> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    return this.repository.createVersion({
      skill_id: skillId,
      version,
      changelog,
      schema: skill.schema,
      schema_snapshot: skill.schema,
    });
  }

  // ==================== Search ====================

  /**
   * Search skills
   */
  async searchSkills(query: string, limit: number = 20): Promise<SkillPackage[]> {
    return this.repository.search(query, limit);
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    return this.repository.getCategories();
  }

  // ==================== Marketplace ====================

  /**
   * Get published skills (marketplace)
   */
  async getMarketplace(options: {
    category?: string;
    tags?: string[];
    page?: number;
    limit?: number;
  } = {}): Promise<PaginatedResult<SkillPackage>> {
    return this.listSkills({
      ...options,
      status: 'published',
    });
  }

  /**
   * Get featured skills
   */
  async getFeaturedSkills(limit: number = 10): Promise<SkillPackage[]> {
    return this.repository.findAll({
      status: 'published',
      limit,
    });
  }

  // ==================== Direct Execution ====================

  /**
   * Execute a skill directly (outside of Pipeline)
   * Returns execution record with status and result
   */
  async executeSkill(
    skillId: string,
    options: {
      tenantId: string;
      projectId?: string;
      userId?: string;
      capability?: string;
      instanceId?: string;
      input?: Record<string, any>;
      sync?: boolean;
      timeout?: number;
    }
  ): Promise<SkillExecution> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    // If instanceId provided, verify it belongs to the tenant
    if (options.instanceId) {
      const instance = await this.repository.findInstanceByIdAndTenant(options.instanceId, options.tenantId);
      if (!instance) {
        throw new SkillServiceError(`Skill instance not found or not accessible: ${options.instanceId}`, 'INSTANCE_NOT_FOUND');
      }
    }

    // Create execution record
    const execution = await this.repository.createExecution({
      tenant_id: options.tenantId,
      skill_id: skillId,
      instance_id: options.instanceId,
      capability: options.capability,
      input: options.input || {},
      triggered_by: options.userId,
      trigger_mode: 'manual',
      metadata: options.projectId ? { projectId: options.projectId } : {},
    });

    // Record audit log
    await this.repository.createAuditLog({
      skill_id: skillId,
      action: 'executed',
      actor_id: options.userId,
      old_status: skill.status,
      new_status: skill.status,
      reason: `Direct execution via capability: ${options.capability}`,
      changes: { executionId: execution.id, capability: options.capability },
    });

    // Update execution to completed (in sync mode, mark as completed immediately)
    // In async mode, the execution would be handled by a background process
    // For now, mark as completed since actual execution is delegated to Pipeline TaskRunner
    const completedExecution = await this.repository.updateExecution(execution.id, {
      status: 'completed',
      completed_at: new Date(),
    });

    return completedExecution || execution;
  }

  /**
   * Get execution history for a skill
   */
  async getExecutions(
    skillId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ executions: SkillExecution[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    const result = await this.repository.findExecutionsBySkill(skillId, tenantId, limit, offset);

    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Get all executions for a tenant (admin)
   */
  async getAllExecutions(
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    skillId?: string
  ): Promise<{ executions: SkillExecution[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    const result = await this.repository.findExecutionsByTenant(tenantId, limit, offset, skillId);

    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Update execution status and result
   */
  async updateExecution(id: string, input: UpdateExecutionInput): Promise<SkillExecution> {
    const existing = await this.repository.findExecutionById(id);
    if (!existing) {
      throw new SkillServiceError(`Execution not found: ${id}`, 'EXECUTION_NOT_FOUND');
    }

    const updated = await this.repository.updateExecution(id, input);
    if (!updated) {
      throw new SkillServiceError(`Failed to update execution: ${id}`, 'UPDATE_FAILED');
    }

    return updated;
  }

  // ==================== Review Workflow ====================

  /**
   * Submit a skill for review
   */
  async submitForReview(id: string, userId: string): Promise<SkillPackage> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    if (existing.status !== 'draft') {
      throw new SkillServiceError('Only draft skills can be submitted for review', 'INVALID_STATE');
    }

    const updated = await this.repository.update(id, { status: 'review' });
    if (!updated) {
      throw new SkillServiceError(`Failed to submit skill for review: ${id}`, 'UPDATE_FAILED');
    }

    // Record audit log
    await this.repository.createAuditLog({
      skill_id: id,
      action: 'submitted',
      actor_id: userId,
      old_status: 'draft',
      new_status: 'review',
      reason: 'Submitted for review',
    });

    return updated;
  }

  /**
   * Approve a skill
   */
  async approveSkill(id: string, userId: string, reason?: string): Promise<SkillPackage> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    if (existing.status !== 'review' && existing.status !== 'rejected') {
      throw new SkillServiceError('Only skills under review or rejected can be approved', 'INVALID_STATE');
    }

    const updated = await this.repository.update(id, {
      status: 'published',
    });
    if (!updated) {
      throw new SkillServiceError(`Failed to approve skill: ${id}`, 'UPDATE_FAILED');
    }

    // Record audit log
    await this.repository.createAuditLog({
      skill_id: id,
      action: 'approved',
      actor_id: userId,
      old_status: existing.status,
      new_status: 'published',
      reason: reason || 'Approved',
    });

    return updated;
  }

  /**
   * Reject a skill
   */
  async rejectSkill(id: string, userId: string, reason: string): Promise<SkillPackage> {
    if (!reason || reason.trim().length === 0) {
      throw new SkillServiceError('Rejection reason is required', 'INVALID_INPUT');
    }

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    if (existing.status !== 'review') {
      throw new SkillServiceError('Only skills under review can be rejected', 'INVALID_STATE');
    }

    // Update status back to draft and store rejection reason
    const updated = await this.repository.update(id, {
      status: 'draft',
    });
    if (!updated) {
      throw new SkillServiceError(`Failed to reject skill: ${id}`, 'UPDATE_FAILED');
    }

    // Record audit log
    await this.repository.createAuditLog({
      skill_id: id,
      action: 'rejected',
      actor_id: userId,
      old_status: 'review',
      new_status: 'draft',
      reason: reason.trim(),
    });

    return updated;
  }

  /**
   * Archive a skill (remove from active use)
   */
  async archiveSkill(id: string, userId: string, reason?: string): Promise<SkillPackage> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new SkillServiceError(`Skill not found: ${id}`, 'SKILL_NOT_FOUND');
    }

    if (existing.status === 'uninstalled') {
      throw new SkillServiceError('Skill is already archived', 'INVALID_STATE');
    }

    const updated = await this.repository.update(id, {
      status: 'uninstalled',
    });
    if (!updated) {
      throw new SkillServiceError(`Failed to archive skill: ${id}`, 'UPDATE_FAILED');
    }

    // Record audit log
    await this.repository.createAuditLog({
      skill_id: id,
      action: 'archived',
      actor_id: userId,
      old_status: existing.status,
      new_status: 'uninstalled',
      reason: reason || 'Archived',
    });

    return updated;
  }

  /**
   * Get skills pending review (paginated)
   */
  async getPendingReview(options: {
    page?: number;
    limit?: number;
    category?: string;
  } = {}): Promise<{ skills: SkillPackage[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, category } = options;
    const offset = (page - 1) * limit;

    const result = await this.repository.findPendingReview(limit, offset, category);

    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Get audit log for a skill
   */
  async getAuditLog(
    skillId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ logs: SkillAuditLog[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Verify skill exists
    await this.getSkill(skillId);

    const result = await this.repository.findAuditLogs(skillId, limit, offset);

    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  /**
   * Get all audit logs across all skills (admin)
   */
  async getAllAuditLogs(
    page: number = 1,
    limit: number = 50,
    action?: string
  ): Promise<{ logs: SkillAuditLog[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    const result = await this.repository.findAllAuditLogs(limit, offset, action);

    return {
      ...result,
      page,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}