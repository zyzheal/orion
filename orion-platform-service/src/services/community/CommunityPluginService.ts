/**
 * CommunityPluginService - 社区插件服务
 *
 * 管理社区插件提交、审核
 *
 * Uses PostgreSQL Repository with graceful degradation to in-memory Map.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CommunityPluginRepository,
  type CommunityPluginEntity,
} from '../../repositories/CommunityRepository';
import { DatabasePool } from '../database';

// ============================================================================
// API Types (unchanged for backward compatibility)
// ============================================================================

export interface PluginInput {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  repository: string;
  compatibility?: string[];
}

export interface CommunityPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  repository: string;
  compatibility: string[];
  status: 'pending' | 'approved' | 'rejected';
  reviewComment?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface PluginFilters {
  category?: string;
  status?: string;
  author?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  category: string;
  status: string;
  downloadCount: number;
}

export interface PluginReview {
  pluginId: string;
  reviewer: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// ============================================================================
// Helpers
// ============================================================================

function pluginEntityToAPI(e: CommunityPluginEntity): CommunityPlugin {
  return {
    id: e.id,
    name: e.name,
    version: e.version,
    description: e.description,
    author: e.author,
    category: e.category,
    repository: e.repository,
    compatibility: e.compatibility || [],
    status: e.status as CommunityPlugin['status'],
    reviewComment: e.reviewComment,
    submittedAt: e.submittedAt.toISOString(),
    reviewedAt: e.reviewedAt?.toISOString(),
  };
}

function pluginRowToAPI(row: any): CommunityPlugin {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    description: row.description,
    author: row.author,
    category: row.category,
    repository: row.repository,
    compatibility: row.compatibility || [],
    status: row.status as CommunityPlugin['status'],
    reviewComment: row.review_comment,
    submittedAt: row.submitted_at?.toISOString?.() ?? new Date(row.submitted_at).toISOString(),
    reviewedAt: row.reviewed_at?.toISOString?.() ?? (row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined),
  };
}

// ============================================================================
// CommunityPluginService
// ============================================================================

export class CommunityPluginService {
  private plugins = new Map<string, CommunityPlugin>();

  private pluginRepo: CommunityPluginRepository | null = null;

  constructor(db?: DatabasePool) {
    if (db) {
      this.pluginRepo = new CommunityPluginRepository(db);
    }
  }

  async submitPlugin(tenantId: string, input: PluginInput): Promise<CommunityPlugin> {
    const id = `plugin-${uuidv4()}`;
    const now = new Date();

    // Database path
    if (this.pluginRepo) {
      const entity = await this.pluginRepo.create({
        id,
        tenantId,
        name: input.name,
        version: input.version,
        description: input.description,
        author: input.author,
        category: input.category,
        repository: input.repository,
        compatibility: input.compatibility || [],
        status: 'pending',
      });
      return pluginEntityToAPI(entity);
    }

    // Map fallback
    const plugin: CommunityPlugin = {
      id,
      name: input.name,
      version: input.version,
      description: input.description,
      author: input.author,
      category: input.category,
      repository: input.repository,
      compatibility: input.compatibility || [],
      status: 'pending',
      submittedAt: now.toISOString(),
    };
    this.plugins.set(id, plugin);
    return plugin;
  }

  async listPlugins(filters?: PluginFilters): Promise<CommunityPlugin[]> {
    // Database path
    if (this.pluginRepo) {
      let query = 'SELECT * FROM community_plugins WHERE 1=1';
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
      if (filters?.author) {
        query += ` AND author = $${paramIdx++}`;
        params.push(filters.author);
      }

      query += ' ORDER BY submitted_at DESC';
      const result = await this.pluginRepo.getDb().query(query, params);
      return result.rows.map(pluginRowToAPI);
    }

    // Map fallback
    let results = Array.from(this.plugins.values());
    if (filters?.category) {
      results = results.filter((p) => p.category === filters.category);
    }
    if (filters?.status) {
      results = results.filter((p) => p.status === filters.status);
    }
    if (filters?.author) {
      results = results.filter((p) => p.author === filters.author);
    }
    return results;
  }

  async reviewPlugin(
    pluginId: string,
    action: 'approve' | 'reject',
    comment: string,
  ): Promise<CommunityPlugin | null> {
    // Database path
    if (this.pluginRepo) {
      const entity = await this.pluginRepo.reviewPlugin(pluginId, action, comment);
      return entity ? pluginEntityToAPI(entity) : null;
    }

    // Map fallback
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return null;
    const now = new Date().toISOString();
    plugin.status = action === 'approve' ? 'approved' : 'rejected';
    plugin.reviewComment = comment;
    plugin.reviewedAt = now;
    this.plugins.set(pluginId, plugin);
    return plugin;
  }
}
