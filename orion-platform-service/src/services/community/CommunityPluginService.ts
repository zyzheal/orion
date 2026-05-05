/**
 * CommunityPluginService - 社区插件服务
 *
 * 管理社区插件提交、审核
 */

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

export class CommunityPluginService {
  private plugins = new Map<string, CommunityPlugin>();

  async submitPlugin(tenantId: string, input: PluginInput): Promise<CommunityPlugin> {
    const id = `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
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
      submittedAt: now,
    };
    this.plugins.set(id, plugin);
    return plugin;
  }

  async listPlugins(filters?: PluginFilters): Promise<CommunityPlugin[]> {
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
