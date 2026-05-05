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
  created_at: Date;
}

export interface PluginInstall {
  id: string;
  tenant_id: string;
  plugin_id: string;
  version: string;
  status: 'installed' | 'pending' | 'error';
  installed_at: Date;
}

export interface PluginReview {
  id: string;
  plugin_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: Date;
}

export class PluginMarketplaceService {
  private pool: DatabasePool;

  constructor(pool: DatabasePool) {
    this.pool = pool;
  }

  async listPlugins(options?: { category?: string; verified?: boolean }): Promise<{ data: MarketplacePlugin[] }> {
    let query = 'SELECT * FROM marketplace_plugins';
    const conditions: string[] = [];
    const params: any[] = [];

    if (options?.category) {
      conditions.push(`category = $${params.length + 1}`);
      params.push(options.category);
    }
    if (options?.verified) {
      conditions.push('verified = true');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY downloads DESC';

    const result = await this.pool.query(query, params);
    return { data: result.rows };
  }

  async getPlugin(pluginId: string): Promise<MarketplacePlugin | null> {
    const result = await this.pool.query('SELECT * FROM marketplace_plugins WHERE id = $1', [pluginId]);
    return result.rows[0] || null;
  }

  async installPlugin(input: { tenant_id: string; plugin_id: string; version?: string }): Promise<PluginInstall> {
    const plugin = await this.getPlugin(input.plugin_id);
    if (!plugin) throw new Error('Plugin not found');

    const result = await this.pool.query(
      `INSERT INTO plugin_installs 
        (tenant_id, plugin_id, version, status, installed_at)
       VALUES ($1, $2, $3, 'installed', now())
       RETURNING *`,
      [input.tenant_id, input.plugin_id, input.version || plugin.version]
    );

    // Update download count
    await this.pool.query(
      'UPDATE marketplace_plugins SET downloads = downloads + 1 WHERE id = $1',
      [input.plugin_id]
    );

    return result.rows[0];
  }

  async uninstallPlugin(tenantId: string, pluginId: string): Promise<{ success: boolean }> {
    const result = await this.pool.query(
      'DELETE FROM plugin_installs WHERE tenant_id = $1 AND plugin_id = $2',
      [tenantId, pluginId]
    );
    return { success: result.rowCount > 0 };
  }

  async reviewPlugin(input: { plugin_id: string; user_id: string; rating: number; comment?: string }): Promise<PluginReview> {
    const result = await this.pool.query(
      `INSERT INTO plugin_reviews 
        (plugin_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.plugin_id, input.user_id, input.rating, input.comment || null]
    );

    // Update plugin rating
    await this.pool.query(
      `UPDATE marketplace_plugins 
       SET rating = (SELECT AVG(rating) FROM plugin_reviews WHERE plugin_id = $1)
       WHERE id = $1`,
      [input.plugin_id]
    );

    return result.rows[0];
  }
}