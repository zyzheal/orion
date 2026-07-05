/**
 * CommunityService - 社区贡献服务
 *
 * 管理社区贡献记录、最佳实践、贡献者信息
 *
 * Uses PostgreSQL Repository with graceful degradation to in-memory Map.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ContributionRepository,
  BestPracticeRepository,
  ContributorRepository,
  type ContributionEntity,
  type BestPracticeEntity,
  type ContributorEntity,
} from '../../repositories/CommunityRepository';
import { DatabasePool } from '../database';

// ============================================================================
// API Types (unchanged for backward compatibility)
// ============================================================================

export interface ContributionInput {
  userId: string;
  type: string;
  title: string;
  description: string;
  repository?: string;
  url?: string;
  tags?: string[];
}

export interface Contribution {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  repository?: string;
  url?: string;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  category: 'pipeline' | 'security' | 'testing' | 'deployment' | 'monitoring' | 'cost' | 'general';
  tags: string[];
  content: string;
  authorId: string;
  authorName: string;
  status: 'draft' | 'published' | 'archived';
  votes: number;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface BestPracticeInput {
  title: string;
  description: string;
  category: string;
  tags?: string[];
  content: string;
  authorId: string;
  authorName?: string;
}

export interface BestPracticeFilters {
  category?: string;
  tags?: string[];
  status?: string;
  search?: string;
  authorId?: string;
}

export interface Contributor {
  userId: string;
  username: string;
  contributions: number;
  types: string[];
  joinedAt: string;
  reputation: number;
  badges?: string[];
}

export interface ContributionFilters {
  type?: string;
  status?: string;
  userId?: string;
  tags?: string[];
}

// ============================================================================
// Helpers: entity/Map-to-API converter
// ============================================================================

function contributionEntityToAPI(e: ContributionEntity): Contribution {
  return {
    id: e.id,
    userId: e.userId,
    type: e.type,
    title: e.title,
    description: e.description,
    repository: e.repository,
    url: e.url,
    tags: e.tags || [],
    status: e.status as Contribution['status'],
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function contributionRowToAPI(row: any): Contribution {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    description: row.description,
    repository: row.repository,
    url: row.url,
    tags: row.tags || [],
    status: row.status as Contribution['status'],
    createdAt: row.created_at?.toISOString?.() ?? new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at?.toISOString?.() ?? new Date(row.updated_at).toISOString(),
  };
}

function bestPracticeEntityToAPI(e: BestPracticeEntity): BestPractice {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    category: e.category as BestPractice['category'],
    tags: e.tags || [],
    content: e.content,
    authorId: e.authorId,
    authorName: e.authorName,
    status: e.status as BestPractice['status'],
    votes: e.votes,
    views: e.views,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function bestPracticeRowToAPI(row: any): BestPractice {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as BestPractice['category'],
    tags: row.tags || [],
    content: row.content,
    authorId: row.author_id,
    authorName: row.author_name,
    status: row.status as BestPractice['status'],
    votes: row.votes,
    views: row.views,
    createdAt: row.created_at?.toISOString?.() ?? new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at?.toISOString?.() ?? new Date(row.updated_at).toISOString(),
  };
}

// ============================================================================
// CommunityService
// ============================================================================

export class CommunityService {
  private contributions = new Map<string, Contribution>();
  private contributors = new Map<string, Contributor>();
  private bestPractices = new Map<string, BestPractice>();

  private contributionRepo: ContributionRepository | null = null;
  private bestPracticeRepo: BestPracticeRepository | null = null;
  private contributorRepo: ContributorRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.contributionRepo = new ContributionRepository(db);
      this.bestPracticeRepo = new BestPracticeRepository(db);
      this.contributorRepo = new ContributorRepository(db);
    }
  }

  // ======================== Contributions ========================

  async createContribution(
    tenantId: string,
    input: ContributionInput,
  ): Promise<Contribution> {
    const id = `contrib-${uuidv4()}`;
    const now = new Date().toISOString();

    // Database path
    if (this.contributionRepo) {
      const entity = await this.contributionRepo.create({
        id,
        tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        description: input.description,
        repository: input.repository ?? null,
        url: input.url ?? null,
        tags: input.tags ?? [],
        status: 'pending',
      });
      return contributionEntityToAPI(entity);
    }

    // Map fallback
    const contribution: Contribution = {
      id,
      userId: input.userId,
      type: input.type,
      title: input.title,
      description: input.description,
      repository: input.repository,
      url: input.url,
      tags: input.tags || [],
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.contributions.set(id, contribution);
    return contribution;
  }

  async listContributions(filters?: ContributionFilters): Promise<Contribution[]> {
    // Database path
    if (this.contributionRepo) {
      let query = 'SELECT * FROM contributions WHERE 1=1';
      const params: unknown[] = [];
      let paramIdx = 1;

      if (filters?.type) {
        query += ` AND type = $${paramIdx++}`;
        params.push(filters.type);
      }
      if (filters?.status) {
        query += ` AND status = $${paramIdx++}`;
        params.push(filters.status);
      }
      if (filters?.userId) {
        query += ` AND user_id = $${paramIdx++}`;
        params.push(filters.userId);
      }
      if (filters?.tags && filters.tags.length > 0) {
        query += ` AND tags @> ARRAY[$${paramIdx}]::varchar[]`;
        params.push(filters.tags[0]);
      }

      query += ' ORDER BY created_at DESC';
      const result = await this.contributionRepo.getDb().query(query, params);
      return result.rows.map(contributionRowToAPI);
    }

    // Map fallback
    let results = Array.from(this.contributions.values());
    if (filters?.type) {
      results = results.filter((c) => c.type === filters.type);
    }
    if (filters?.status) {
      results = results.filter((c) => c.status === filters.status);
    }
    if (filters?.userId) {
      results = results.filter((c) => c.userId === filters.userId);
    }
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter((c) =>
        filters.tags!.some((t) => c.tags.includes(t)),
      );
    }
    return results;
  }

  async getContribution(id: string): Promise<Contribution | null> {
    // Database path
    if (this.contributionRepo) {
      const entity = await this.contributionRepo.findById(id);
      return entity ? contributionEntityToAPI(entity) : null;
    }

    // Map fallback
    const entry = this.contributions.get(id);
    return entry || null;
  }

  // ======================== Contributors ========================

  async getContributor(userId: string): Promise<Contributor | null> {
    // Database path
    if (this.contributorRepo && this.contributionRepo) {
      const cached = await this.contributorRepo.findById(userId);
      if (cached) {
        return {
          userId: cached.userId,
          username: cached.username,
          contributions: cached.contributions,
          types: cached.types,
          joinedAt: cached.joinedAt.toISOString(),
          reputation: cached.reputation,
          badges: cached.badges,
        };
      }

      // Not cached — compute from contributions table
      const contribs = await this.contributionRepo.listByUserId('', userId);
      if (contribs.length === 0) return null;

      const types = [...new Set(contribs.map((c) => c.type))];
      const approvedCount = contribs.filter((c) => c.status === 'approved').length;

      const username = `user-${userId.slice(0, 8)}`;
      await this.contributorRepo.upsert(userId, {
        username,
        contributions: contribs.length,
        types,
        reputation: approvedCount * 10,
      });

      return {
        userId,
        username,
        contributions: contribs.length,
        types,
        joinedAt: new Date().toISOString(),
        reputation: approvedCount * 10,
      };
    }

    // Map fallback
    if (!this.contributors.has(userId)) {
      const contribs = Array.from(this.contributions.values()).filter(
        (c) => c.userId === userId,
      );
      const types = [...new Set(contribs.map((c) => c.type))];
      this.contributors.set(userId, {
        userId,
        username: `user-${userId.slice(0, 8)}`,
        contributions: contribs.length,
        types,
        joinedAt: new Date().toISOString(),
        reputation: contribs.filter((c) => c.status === 'approved').length * 10,
      });
    }
    return this.contributors.get(userId) || null;
  }

  async listContributors(limit?: number): Promise<Contributor[]> {
    // Database path
    if (this.contributorRepo) {
      const entities = await this.contributorRepo.findAll();
      // Also ensure contributors derived from contributions are synced
      if (this.contributionRepo) {
        const contribs = await this.contributionRepo.findAll({ limit: 1000 });
        for (const c of contribs.entities) {
          const existing = entities.find(e => e.userId === c.userId);
          if (!existing) {
            // Sync missing contributor to DB
            const approvedCount = contribs.entities.filter(x => x.userId === c.userId && x.status === 'approved').length;
            await this.contributorRepo.upsert(c.userId, {
              username: `user-${c.userId.slice(0, 8)}`,
              contributions: contribs.entities.filter(x => x.userId === c.userId).length,
              types: [...new Set(contribs.entities.filter(x => x.userId === c.userId).map(x => x.type))],
              reputation: approvedCount * 10,
            });
          }
        }
      }

      let result = entities.map(e => ({
        userId: e.userId,
        username: e.username,
        contributions: e.contributions,
        types: e.types,
        joinedAt: e.joinedAt.toISOString(),
        reputation: e.reputation,
        badges: e.badges,
      }));
      result.sort((a, b) => b.reputation - a.reputation);
      if (limit) {
        result = result.slice(0, limit);
      }
      return result;
    }

    // Map fallback
    for (const contribution of this.contributions.values()) {
      if (!this.contributors.has(contribution.userId)) {
        await this.getContributor(contribution.userId);
      }
    }
    let contributors = Array.from(this.contributors.values());
    contributors.sort((a, b) => b.reputation - a.reputation);
    if (limit) {
      contributors = contributors.slice(0, limit);
    }
    return contributors;
  }

  // ======================== Best Practices ========================

  async createBestPractice(input: BestPracticeInput): Promise<BestPractice> {
    const id = `bp-${uuidv4()}`;
    const now = new Date();

    // Database path
    if (this.bestPracticeRepo) {
      const entity = await this.bestPracticeRepo.create({
        id,
        title: input.title,
        description: input.description,
        category: input.category,
        tags: input.tags ?? [],
        content: input.content,
        authorId: input.authorId,
        authorName: input.authorName || `user-${input.authorId.slice(0, 8)}`,
        status: 'published',
        votes: 0,
        views: 0,
      });
      return bestPracticeEntityToAPI(entity);
    }

    // Map fallback
    const practice: BestPractice = {
      id,
      title: input.title,
      description: input.description,
      category: input.category as BestPractice['category'],
      tags: input.tags || [],
      content: input.content,
      authorId: input.authorId,
      authorName: input.authorName || `user-${input.authorId.slice(0, 8)}`,
      status: 'published',
      votes: 0,
      views: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.bestPractices.set(id, practice);
    return practice;
  }

  async listBestPractices(filters?: BestPracticeFilters): Promise<BestPractice[]> {
    // Database path
    if (this.bestPracticeRepo) {
      let query = 'SELECT * FROM best_practices WHERE 1=1';
      const params: unknown[] = [];
      let paramIdx = 1;

      if (filters?.category) {
        query += ` AND category = $${paramIdx++}`;
        params.push(filters.category);
      }
      if (filters?.status) {
        query += ` AND status = $${paramIdx++}`;
        params.push(filters.status);
      }
      if (filters?.authorId) {
        query += ` AND author_id = $${paramIdx++}`;
        params.push(filters.authorId);
      }
      if (filters?.search) {
        query += ` AND (title ILIKE $${paramIdx} OR description ILIKE $${paramIdx} OR tags::text ILIKE $${paramIdx})`;
        params.push(`%${filters.search.toLowerCase()}%`);
        paramIdx++;
      }

      query += ' ORDER BY votes DESC';
      const result = await this.bestPracticeRepo.getDb().query(query, params);
      return result.rows.map(bestPracticeRowToAPI);
    }

    // Map fallback
    let results = Array.from(this.bestPractices.values());

    if (filters?.category) {
      results = results.filter((b) => b.category === filters.category);
    }
    if (filters?.status) {
      results = results.filter((b) => b.status === filters.status);
    }
    if (filters?.authorId) {
      results = results.filter((b) => b.authorId === filters.authorId);
    }
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter((b) =>
        filters.tags!.some((t) => b.tags.includes(t)),
      );
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(
        (b) =>
          b.title.toLowerCase().includes(search) ||
          b.description.toLowerCase().includes(search) ||
          b.tags.some((t) => t.toLowerCase().includes(search)),
      );
    }

    return results.sort((a, b) => b.votes - a.votes);
  }

  async getBestPractice(id: string): Promise<BestPractice | null> {
    // Database path
    if (this.bestPracticeRepo) {
      const entity = await this.bestPracticeRepo.findById(id);
      if (!entity) return null;
      // Increment views
      const updated = await this.bestPracticeRepo.incrementViews(id);
      return updated ? bestPracticeEntityToAPI(updated) : bestPracticeEntityToAPI(entity);
    }

    // Map fallback
    const practice = this.bestPractices.get(id);
    if (practice) {
      practice.views += 1;
      this.bestPractices.set(id, practice);
    }
    return practice || null;
  }

  async voteBestPractice(id: string, direction: 'up' | 'down'): Promise<BestPractice | null> {
    // Database path
    if (this.bestPracticeRepo) {
      const delta = direction === 'up' ? 1 : -1;
      const entity = await this.bestPracticeRepo.incrementVotes(id, delta);
      return entity ? bestPracticeEntityToAPI(entity) : null;
    }

    // Map fallback
    const practice = this.bestPractices.get(id);
    if (!practice) return null;
    practice.votes += direction === 'up' ? 1 : -1;
    this.bestPractices.set(id, practice);
    return practice;
  }

  async deleteBestPractice(id: string): Promise<boolean> {
    // Database path
    if (this.bestPracticeRepo) {
      return this.bestPracticeRepo.delete(id);
    }

    // Map fallback
    return this.bestPractices.delete(id);
  }
}
