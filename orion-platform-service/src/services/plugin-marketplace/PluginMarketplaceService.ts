/**
 * Plugin Marketplace Service - Phase 3
 *
 * Plugin discovery, rating, and installation management
 */

import { DatabasePool } from '../database';

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  version: string;
  rating: number;
  downloads: number;
  verified: boolean;
  price_cents: number;
  tags: string[];
  icon_url?: string;
  repository_url?: string;
  documentation_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface PluginInstall {
  id: string;
  tenant_id: string;
  plugin_id: string;
  version: string;
  status: 'installed' | 'active' | 'disabled' | 'uninstalled';
  installed_at: Date;
  updated_at: Date;
}

export interface PluginReview {
  id: string;
  plugin_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}

export interface PluginQualityScore {
  pluginId: string;
  qualityScore: number;
  ratingScore: number;
  stabilityScore: number;
  securityScore: number;
  adoptionScore: number;
  computedAt: Date;
}

export interface ListPluginsFilter {
  category?: string;
  verified?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PublishPluginInput {
  name: string;
  description: string;
  author: string;
  category: string;
  version: string;
  tags?: string[];
  icon_url?: string;
  repository_url?: string;
  documentation_url?: string;
  price_cents?: number;
}

export interface InstallPluginInput {
  tenant_id: string;
  plugin_id: string;
  version?: string;
}

export interface ReviewPluginInput {
  plugin_id: string;
  user_id: string;
  rating: number;
  comment?: string;
}

export class PluginMarketplaceService {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async listPlugins(filter?: ListPluginsFilter): Promise<{ data: MarketplacePlugin[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter?.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(filter.category);
    }
    if (filter?.verified !== undefined) {
      conditions.push(`verified = $${paramIndex++}`);
      params.push(filter.verified);
    }
    if (filter?.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM marketplace_plugins ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get data
    const limit = filter?.limit ?? 50;
    const offset = filter?.offset ?? 0;
    const dataResult = await this.pool.query(
      `SELECT * FROM marketplace_plugins
       ${whereClause}
       ORDER BY downloads DESC, rating DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows.map((r: any) => this.mapPluginRow(r)),
      total,
    };
  }

  /**
   * Publish a plugin to the marketplace
   */
  async publishPlugin(tenantId: string, input: PublishPluginInput): Promise<MarketplacePlugin> {
    const result = await this.pool.query(
      `INSERT INTO marketplace_plugins
        (name, description, author, category, version, tags, icon_url, repository_url, documentation_url, price_cents, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
       RETURNING *`,
      [
        input.name,
        input.description,
        input.author,
        input.category,
        input.version,
        input.tags || [],
        input.icon_url || null,
        input.repository_url || null,
        input.documentation_url || null,
        input.price_cents || 0,
      ]
    );
    return this.mapPluginRow(result.rows[0]);
  }

  async getPlugin(pluginId: string): Promise<MarketplacePlugin | null> {
    const result = await this.pool.query(
      'SELECT * FROM marketplace_plugins WHERE id = $1',
      [pluginId]
    );
    if (!result.rows[0]) return null;
    return this.mapPluginRow(result.rows[0]);
  }

  async installPlugin(input: InstallPluginInput): Promise<PluginInstall> {
    const plugin = await this.getPlugin(input.plugin_id);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    const version = input.version || plugin.version;

    const installResult = await this.pool.query(
      `INSERT INTO plugin_installations
        (tenant_id, plugin_id, version, status)
       VALUES ($1, $2, $3, 'installed')
       RETURNING *`,
      [input.tenant_id, input.plugin_id, version]
    );

    await this.pool.query(
      'UPDATE marketplace_plugins SET downloads = downloads + 1 WHERE id = $1',
      [input.plugin_id]
    );

    return this.mapInstallRow(installResult.rows[0]);
  }

  async uninstallPlugin(tenantId: string, pluginId: string): Promise<{ success: boolean }> {
    const result = await this.pool.query(
      `UPDATE plugin_installations
       SET status = 'uninstalled', updated_at = NOW()
       WHERE tenant_id = $1 AND plugin_id = $2 AND status != 'uninstalled'`,
      [tenantId, pluginId]
    );
    return { success: result.rowCount > 0 };
  }

  async reviewPlugin(input: ReviewPluginInput): Promise<PluginReview> {
    if (input.rating < 1 || input.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const result = await this.pool.query(
      `INSERT INTO plugin_reviews
        (plugin_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.plugin_id, input.user_id, input.rating, input.comment || null]
    );

    // Update plugin average rating
    await this.pool.query(
      `UPDATE marketplace_plugins
       SET rating = (SELECT AVG(rating) FROM plugin_reviews WHERE plugin_id = $1)
       WHERE id = $1`,
      [input.plugin_id]
    );

    return this.mapReviewRow(result.rows[0]);
  }

  /**
   * Get plugin quality score (composite metric)
   */
  async getPluginQualityScore(pluginId: string): Promise<PluginQualityScore> {
    const plugin = await this.getPlugin(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    // Get review statistics
    const reviewStats = await this.pool.query(
      `SELECT
         COUNT(*) as review_count,
         AVG(rating) as avg_rating,
         MIN(rating) as min_rating,
         MAX(rating) as max_rating
       FROM plugin_reviews
       WHERE plugin_id = $1`,
      [pluginId]
    );
    const stats = reviewStats.rows[0];

    // Get installation statistics
    const installStats = await this.pool.query(
      `SELECT COUNT(*) as install_count
       FROM plugin_installations
       WHERE plugin_id = $1 AND status IN ('installed', 'active')`,
      [pluginId]
    );
    const installCount = parseInt(installStats.rows[0].install_count, 10);

    // Compute quality scores (0-100)
    const ratingScore = Math.round(((stats?.avg_rating || 0) / 5) * 100);
    const stabilityScore = Math.min(100, Math.round((plugin.downloads / 10) * 10));
    const securityScore = plugin.verified ? 90 : 50;
    const adoptionScore = Math.min(100, Math.round((installCount / 50) * 100));

    // Composite score (weighted)
    const qualityScore = Math.round(
      ratingScore * 0.35 +
      stabilityScore * 0.25 +
      securityScore * 0.20 +
      adoptionScore * 0.20
    );

    return {
      pluginId,
      qualityScore: Math.min(100, qualityScore),
      ratingScore: Math.min(100, ratingScore),
      stabilityScore: Math.min(100, stabilityScore),
      securityScore,
      adoptionScore: Math.min(100, adoptionScore),
      computedAt: new Date(),
    };
  }

  /**
   * List installed plugins for a tenant
   */
  async listInstalledPlugins(tenantId: string): Promise<PluginInstall[]> {
    const result = await this.pool.query(
      `SELECT * FROM plugin_installations
       WHERE tenant_id = $1 AND status != 'uninstalled'
       ORDER BY installed_at DESC`,
      [tenantId]
    );
    return result.rows.map((r: any) => this.mapInstallRow(r));
  }

  /**
   * List reviews for a plugin
   */
  async listPluginReviews(pluginId: string, limit?: number): Promise<PluginReview[]> {
    const result = await this.pool.query(
      `SELECT * FROM plugin_reviews
       WHERE plugin_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [pluginId, limit || 20]
    );
    return result.rows.map((r: any) => this.mapReviewRow(r));
  }

  // ==================== Row Mappers ====================

  private mapPluginRow(row: any): MarketplacePlugin {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      author: row.author,
      category: row.category,
      version: row.version,
      rating: parseFloat(row.rating) || 0,
      downloads: parseInt(row.downloads, 10) || 0,
      verified: row.verified || false,
      price_cents: parseInt(row.price_cents, 10) || 0,
      tags: row.tags || [],
      icon_url: row.icon_url,
      repository_url: row.repository_url,
      documentation_url: row.documentation_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapInstallRow(row: any): PluginInstall {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      plugin_id: row.plugin_id,
      version: row.version,
      status: row.status,
      installed_at: row.installed_at,
      updated_at: row.updated_at,
    };
  }

  private mapReviewRow(row: any): PluginReview {
    return {
      id: row.id,
      plugin_id: row.plugin_id,
      user_id: row.user_id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at,
    };
  }
}