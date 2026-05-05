/**
 * CommunityService - 社区贡献服务
 *
 * 管理社区贡献记录、贡献者信息
 */

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

export class CommunityService {
  private contributions = new Map<string, Contribution>();
  private contributors = new Map<string, Contributor>();
  private bestPractices = new Map<string, BestPractice>();

  async createContribution(
    tenantId: string,
    input: ContributionInput,
  ): Promise<Contribution> {
    const id = `contrib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
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
    return this.contributions.get(id) || null;
  }

  async getContributor(userId: string): Promise<Contributor | null> {
    if (!this.contributors.has(userId)) {
      const contributions = Array.from(this.contributions.values()).filter(
        (c) => c.userId === userId,
      );
      const types = [...new Set(contributions.map((c) => c.type))];
      this.contributors.set(userId, {
        userId,
        username: `user-${userId.slice(0, 8)}`,
        contributions: contributions.length,
        types,
        joinedAt: new Date().toISOString(),
        reputation: contributions.filter((c) => c.status === 'approved').length * 10,
      });
    }
    return this.contributors.get(userId) || null;
  }

  // ========== Best Practice Management ==========

  async createBestPractice(input: BestPracticeInput): Promise<BestPractice> {
    const id = `bp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
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
      createdAt: now,
      updatedAt: now,
    };
    this.bestPractices.set(id, practice);
    return practice;
  }

  async listBestPractices(filters?: BestPracticeFilters): Promise<BestPractice[]> {
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
    const practice = this.bestPractices.get(id);
    if (practice) {
      practice.views += 1;
      this.bestPractices.set(id, practice);
    }
    return practice || null;
  }

  async voteBestPractice(id: string, direction: 'up' | 'down'): Promise<BestPractice | null> {
    const practice = this.bestPractices.get(id);
    if (!practice) return null;
    practice.votes += direction === 'up' ? 1 : -1;
    this.bestPractices.set(id, practice);
    return practice;
  }

  async deleteBestPractice(id: string): Promise<boolean> {
    return this.bestPractices.delete(id);
  }

  // ========== Contributor Listing ==========

  async listContributors(limit?: number): Promise<Contributor[]> {
    // Ensure all contributors with contributions are populated
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
}
