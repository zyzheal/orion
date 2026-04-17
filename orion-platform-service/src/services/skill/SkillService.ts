/**
 * Skill Package Service - 管理技能包、版本、安装、评分
 */

import {
  SkillPackage,
  SkillPackageCreateInput,
  SkillPackageUpdateInput,
  createSkillPackage,
  SkillVersion,
  SkillVersionCreateInput,
  createSkillVersion,
  SkillReview,
  SkillReviewCreateInput,
  createSkillReview,
  SkillStatus,
  SkillCategory,
} from '../../models/SkillPackage';

export interface SkillListFilter {
  q?: string;
  category?: SkillCategory;
  tag?: string;
  status?: SkillStatus;
  page?: number;
  perPage?: number;
}

export class SkillService {
  private skills: Map<string, SkillPackage> = new Map();
  private versions: Map<string, SkillVersion[]> = new Map();
  private reviews: Map<string, SkillReview[]> = new Map();

  // ==================== Skill CRUD ====================

  async create(input: SkillPackageCreateInput): Promise<SkillPackage> {
    const skill = createSkillPackage(input);
    this.skills.set(skill.id, skill);
    this.versions.set(skill.id, []);
    this.reviews.set(skill.id, []);
    return skill;
  }

  async getById(id: string): Promise<SkillPackage | undefined> {
    return this.skills.get(id);
  }

  async list(filter: SkillListFilter = {}): Promise<{ skills: SkillPackage[]; total: number }> {
    let items = Array.from(this.skills.values());

    // 全文搜索（name / description / author / tags）
    if (filter.q) {
      const query = filter.q.toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.author.toLowerCase().includes(query) ||
          s.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    if (filter.category) {
      items = items.filter((s) => s.category === filter.category);
    }

    if (filter.tag) {
      const tag = filter.tag.toLowerCase();
      items = items.filter((s) => s.tags.some((t) => t.toLowerCase() === tag));
    }

    if (filter.status) {
      items = items.filter((s) => s.status === filter.status);
    }

    const total = items.length;
    const page = filter.page ?? 1;
    const perPage = filter.perPage ?? 20;
    const start = (page - 1) * perPage;
    const paged = items.slice(start, start + perPage);

    return { skills: paged, total };
  }

  async update(id: string, input: SkillPackageUpdateInput): Promise<SkillPackage | undefined> {
    const skill = this.skills.get(id);
    if (!skill) return undefined;

    if (input.name !== undefined) skill.name = input.name;
    if (input.description !== undefined) skill.description = input.description;
    if (input.category !== undefined) skill.category = input.category;
    if (input.tags !== undefined) skill.tags = input.tags;
    if (input.status !== undefined) skill.status = input.status;
    if (input.schema !== undefined) skill.schema = input.schema;
    skill.updatedAt = new Date();

    this.skills.set(id, skill);
    return skill;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.skills.delete(id);
    if (deleted) {
      this.versions.delete(id);
      this.reviews.delete(id);
    }
    return deleted;
  }

  // ==================== Version Management ====================

  async addVersion(input: SkillVersionCreateInput): Promise<SkillVersion> {
    const skill = this.skills.get(input.skillId);
    if (!skill) {
      throw new Error(`Skill ${input.skillId} not found`);
    }

    // 将所有旧版本标记为非最新
    const versions = this.versions.get(input.skillId) ?? [];
    for (const v of versions) {
      v.isLatest = false;
    }

    const version = createSkillVersion(input);
    versions.push(version);
    this.versions.set(input.skillId, versions);

    // 更新 skill 当前版本
    skill.version = input.version;
    skill.updatedAt = new Date();
    this.skills.set(input.skillId, skill);

    return version;
  }

  async listVersions(skillId: string): Promise<SkillVersion[]> {
    return this.versions.get(skillId) ?? [];
  }

  // ==================== Install / Uninstall ====================

  async install(skillId: string): Promise<SkillPackage | undefined> {
    const skill = this.skills.get(skillId);
    if (!skill) return undefined;

    skill.installCount += 1;
    skill.updatedAt = new Date();
    this.skills.set(skillId, skill);
    return skill;
  }

  async uninstall(skillId: string): Promise<SkillPackage | undefined> {
    const skill = this.skills.get(skillId);
    if (!skill) return undefined;

    if (skill.installCount > 0) {
      skill.installCount -= 1;
    }
    skill.updatedAt = new Date();
    this.skills.set(skillId, skill);
    return skill;
  }

  // ==================== Rating ====================

  async rate(input: SkillReviewCreateInput): Promise<SkillReview> {
    const skill = this.skills.get(input.skillId);
    if (!skill) {
      throw new Error(`Skill ${input.skillId} not found`);
    }

    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const reviews = this.reviews.get(input.skillId) ?? [];

    // 检查用户是否已经评过分，如果是则更新
    const existingIndex = reviews.findIndex((r) => r.userId === input.userId);
    if (existingIndex >= 0) {
      const oldRating = reviews[existingIndex].rating;
      reviews[existingIndex].rating = input.rating;
      reviews[existingIndex].comment = input.comment ?? reviews[existingIndex].comment;

      // 重新计算平均评分
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      skill.rating = totalRating / reviews.length;
      skill.ratingCount = reviews.length;
    } else {
      const review = createSkillReview(input);
      reviews.push(review);

      // 重新计算平均评分
      const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
      skill.rating = totalRating / reviews.length;
      skill.ratingCount = reviews.length;
    }

    this.reviews.set(input.skillId, reviews);
    skill.updatedAt = new Date();
    this.skills.set(input.skillId, skill);

    // 返回最新添加或更新的 review
    return reviews[existingIndex >= 0 ? existingIndex : reviews.length - 1];
  }

  async getReviews(skillId: string): Promise<SkillReview[]> {
    return this.reviews.get(skillId) ?? [];
  }
}
