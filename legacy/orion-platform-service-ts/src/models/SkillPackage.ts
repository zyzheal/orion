/**
 * Skill Package 数据模型
 *
 * 技能包管理：版本控制、安装追踪、评分系统
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== SkillPackage ====================

export type SkillStatus = 'draft' | 'review' | 'published' | 'uninstalled';
export type SkillCategory =
  | 'data-processing'
  | 'ai-ml'
  | 'testing'
  | 'deployment'
  | 'monitoring'
  | 'security'
  | 'ci-cd'
  | 'utility'
  | 'custom';

export interface SkillPackage {
  id: string;
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  tags: string[];
  author: string;
  status: SkillStatus;
  schema: Record<string, unknown>;
  installCount: number;
  rating: number; // 平均评分 0-5
  ratingCount: number; // 评分次数
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillPackageCreateInput {
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  tags?: string[];
  author: string;
  schema?: Record<string, unknown>;
}

export interface SkillPackageUpdateInput {
  name?: string;
  description?: string;
  category?: SkillCategory;
  tags?: string[];
  status?: SkillStatus;
  schema?: Record<string, unknown>;
}

export function createSkillPackage(input: SkillPackageCreateInput): SkillPackage {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    version: input.version,
    description: input.description,
    category: input.category,
    tags: input.tags ?? [],
    author: input.author,
    status: 'draft',
    schema: input.schema ?? {},
    installCount: 0,
    rating: 0,
    ratingCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== SkillVersion ====================

export interface SkillVersion {
  id: string;
  skillId: string;
  version: string;
  changelog?: string;
  schema: Record<string, unknown>;
  isLatest: boolean;
  createdAt: Date;
}

export interface SkillVersionCreateInput {
  skillId: string;
  version: string;
  changelog?: string;
  schema?: Record<string, unknown>;
}

export function createSkillVersion(input: SkillVersionCreateInput): SkillVersion {
  return {
    id: uuidv4(),
    skillId: input.skillId,
    version: input.version,
    changelog: input.changelog,
    schema: input.schema ?? {},
    isLatest: true,
    createdAt: new Date(),
  };
}

// ==================== SkillReview ====================

export interface SkillReview {
  id: string;
  skillId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

export interface SkillReviewCreateInput {
  skillId: string;
  userId: string;
  rating: number;
  comment?: string;
}

export function createSkillReview(input: SkillReviewCreateInput): SkillReview {
  return {
    id: uuidv4(),
    skillId: input.skillId,
    userId: input.userId,
    rating: input.rating,
    comment: input.comment,
    createdAt: new Date(),
  };
}
