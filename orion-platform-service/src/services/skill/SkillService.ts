/**
 * SkillService - Business logic layer for Skill operations
 * 
 * Handles skill package management, versioning, and reviews
 */

import { 
  SkillRepository, 
  SkillPackage,
  SkillVersion,
  SkillReview,
  CreateSkillInput,
  UpdateSkillInput,
  CreateSkillVersionInput,
  CreateSkillReviewInput
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
  }): Promise<SkillVersion> {
    const skill = await this.repository.findById(skillId);
    if (!skill) {
      throw new SkillServiceError(`Skill not found: ${skillId}`, 'SKILL_NOT_FOUND');
    }

    return this.repository.createVersion({
      skill_id: skillId,
      version: input.version,
      changelog: input.changelog,
      schema: input.schema,
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
}