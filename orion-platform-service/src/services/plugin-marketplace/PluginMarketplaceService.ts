/**
 * PluginMarketplaceService - 插件市场服务
 *
 * Provides plugin marketplace functionality including publishing, listing,
 * installing, rating, and quality scoring using PostgreSQL-backed repositories.
 *
 * TASK-703: Plugin Marketplace
 */

import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import {
  PostgresPluginRepository,
  PluginRepository,
} from '../../repositories/PluginRepository';
import {
  PluginExecutionRepository,
  PluginExecutionEntity,
} from '../../repositories/PluginExecutionRepository';
import {
  PostgresPluginAuditLogRepository,
  PluginAuditLogRepository,
} from '../../repositories/PluginAuditLogRepository';
import type { DatabasePool } from '../database';
import { PluginInfo, PluginType, PluginState } from '../plugin-manager-service';
import { OrionError, ErrorCode } from '../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ==================== Domain Types ====================

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
  tags: string[];
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

export interface PluginListing {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  version: string;
  tags: string[];
  icon_url?: string;
  repository_url?: string;
  documentation_url?: string;
  price_cents?: number;
  ratings: {
    average: number;
    count: number;
  };
  installedCount: number;
  verified: boolean;
  publishedAt: Date;
  updatedAt: Date;
}

export interface PluginInstallResult {
  id: string;
  plugin_id: string;
  tenant_id: string;
  version: string;
  installedAt: Date;
  status: string;
}

export interface PluginReview {
  id: string;
  plugin_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface QualityScore {
  pluginId: string;
  overallScore: number;
  securityScore: number;
  reliabilityScore: number;
  maintainabilityScore: number;
  documentationScore: number;
  reviewsCount: number;
  averageRating: number;
}

// ==================== In-memory stores ====================

const pluginListings = new Map<string, PluginListing>();
const pluginReviews = new Map<string, PluginReview[]>();
const pluginInstalls = new Map<string, PluginInstallResult[]>();

// Initialize default plugins
function initializeDefaultPlugins(): void {
  const defaults: PluginListing[] = [
    {
      id: 'security-scan',
      name: 'security-scan',
      description: 'Execute security scans using Trivy/Semgrep',
      author: 'Orion Team',
      category: 'security',
      version: '1.0.0',
      tags: ['security', 'vulnerability', 'trivy', 'semgrep'],
      icon_url: undefined,
      repository_url: undefined,
      documentation_url: undefined,
      price_cents: 0,
      ratings: { average: 4.5, count: 12 },
      installedCount: 45,
      verified: true,
      publishedAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-03-20'),
    },
    {
      id: 'code-quality',
      name: 'code-quality',
      description: 'Execute ESLint code quality checks',
      author: 'Orion Team',
      category: 'quality',
      version: '1.0.0',
      tags: ['code-quality', 'eslint', 'lint'],
      icon_url: undefined,
      repository_url: undefined,
      documentation_url: undefined,
      price_cents: 0,
      ratings: { average: 4.2, count: 8 },
      installedCount: 32,
      verified: true,
      publishedAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-03-15'),
    },
    {
      id: 'aws-deploy',
      name: 'aws-deploy',
      description: 'Deploy applications to AWS ECS/Fargate',
      author: 'AWS Community',
      category: 'deployment',
      version: '2.1.0',
      tags: ['aws', 'ecs', 'fargate', 'deployment', 'cloud'],
      icon_url: undefined,
      repository_url: 'https://github.com/example/aws-deploy',
      documentation_url: undefined,
      price_cents: 499,
      ratings: { average: 4.8, count: 25 },
      installedCount: 128,
      verified: true,
      publishedAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-04-01'),
    },
  ];

  for (const plugin of defaults) {
    pluginListings.set(plugin.id, plugin);
  }
}

// Initialize defaults on module load
initializeDefaultPlugins();

export class PluginMarketplaceService {
  private pluginRepository: PluginRepository | null;
  private executionRepository: PluginExecutionRepository | null;
  private auditLogRepository: PluginAuditLogRepository | null;

  /**
   * @param db - DatabasePool, or null for in-memory mode.
   */
  constructor(db: DatabasePool | null) {
    if (!db) {
      this.pluginRepository = null;
      this.executionRepository = null;
      this.auditLogRepository = null;
    } else {
      this.pluginRepository = new PostgresPluginRepository(db);
      this.executionRepository = new PluginExecutionRepository(db);
      this.auditLogRepository = new PostgresPluginAuditLogRepository(db);
    }
  }

  // ==================== Plugin Listing ====================

  /**
   * List plugins from marketplace.
   */
  async listPlugins(filter: ListPluginsFilter = {}): Promise<{ data: PluginListing[]; total: number }> {
    let plugins = Array.from(pluginListings.values());

    // Apply filters
    if (filter.category) {
      plugins = plugins.filter((p) => p.category === filter.category);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      plugins = plugins.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower) ||
          p.tags.some((t) => t.toLowerCase().includes(searchLower))
      );
    }
    if (filter.verified !== undefined) {
      plugins = plugins.filter((p) => p.verified === filter.verified);
    }

    // Sort by installedCount desc (popularity)
    plugins.sort((a, b) => b.installedCount - a.installedCount);

    const total = plugins.length;
    const limit = filter.limit ?? 20;
    const offset = filter.offset ?? 0;
    const paged = plugins.slice(offset, offset + limit);

    return { data: paged, total };
  }

  /**
   * Get a specific plugin by ID.
   */
  async getPlugin(pluginId: string): Promise<PluginListing | undefined> {
    return pluginListings.get(pluginId);
  }

  // ==================== Plugin Publishing ====================

  /**
   * Publish a new plugin to the marketplace.
   */
  async publishPlugin(tenantId: string, input: PublishPluginInput): Promise<PluginListing> {
    const id = uuidv4();
    const now = new Date();

    const listing: PluginListing = {
      id,
      name: input.name,
      description: input.description,
      author: input.author,
      category: input.category,
      version: input.version,
      tags: input.tags,
      icon_url: input.icon_url,
      repository_url: input.repository_url,
      documentation_url: input.documentation_url,
      price_cents: input.price_cents,
      ratings: { average: 0, count: 0 },
      installedCount: 0,
      verified: false,
      publishedAt: now,
      updatedAt: now,
    };

    pluginListings.set(id, listing);

    logger.info({ pluginId: id, name: input.name }, '[PluginMarketplace] Plugin published');

    // Persist to database if repository available
    if (this.pluginRepository && this.auditLogRepository) {
      try {
        await this.pluginRepository.create({
          id,
          name: input.name,
          version: input.version,
          description: input.description,
          author: input.author,
          tags: input.tags,
          type: 'CUSTOM_TASK' as PluginType,
          securityLevel: 'MEDIUM',
          configSchema: {},
          state: 'AVAILABLE' as PluginState,
          installedAt: now,
          updatedAt: now,
          config: {},
        });

        await this.auditLogRepository.create({
          taskId: uuidv4(),
          pluginId: id,
          userId: 'system',
          tenantId,
          action: 'plugin_published' as any,
          outcome: 'success',
        });
      } catch (error) {
        logger.warn({ error }, '[PluginMarketplace] Failed to persist plugin to DB');
      }
    }

    return listing;
  }

  // ==================== Plugin Installation ====================

  /**
   * Install a plugin for a tenant.
   */
  async installPlugin(input: InstallPluginInput, userId: string): Promise<PluginInstallResult> {
    const listing = pluginListings.get(input.plugin_id);
    if (!listing) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin '${input.plugin_id}' not found`);
    }

    const installs = pluginInstalls.get(input.tenant_id) ?? [];

    // Check if already installed
    const existing = installs.find((i) => i.plugin_id === input.plugin_id && i.status === 'active');
    if (existing) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin '${input.plugin_id}' is already installed`);
    }

    const now = new Date();
    const installResult: PluginInstallResult = {
      id: uuidv4(),
      plugin_id: input.plugin_id,
      tenant_id: input.tenant_id,
      version: input.version ?? listing.version,
      installedAt: now,
      status: 'active',
    };

    installs.push(installResult);
    pluginInstalls.set(input.tenant_id, installs);

    // Update installed count
    listing.installedCount++;
    listing.updatedAt = now;

    logger.info(
      { pluginId: input.plugin_id, tenantId: input.tenant_id },
      '[PluginMarketplace] Plugin installed'
    );

    // Persist to database
    if (this.pluginRepository && this.auditLogRepository) {
      try {
        await this.pluginRepository.updateState(input.plugin_id, 'INSTALLED');

        await this.auditLogRepository.create({
          taskId: uuidv4(),
          pluginId: input.plugin_id,
          userId,
          tenantId: input.tenant_id,
          action: 'plugin_installed' as any,
          outcome: 'success',
        });
      } catch (error) {
        logger.warn({ error }, '[PluginMarketplace] Failed to persist install to DB');
      }
    }

    return installResult;
  }

  // ==================== Plugin Rating/Reviews ====================

  /**
   * Submit a review for a plugin.
   */
  async reviewPlugin(input: ReviewPluginInput): Promise<PluginReview> {
    const listing = pluginListings.get(input.plugin_id);
    if (!listing) {
      throw new OrionError(ErrorCode.NOT_FOUND, `Plugin '${input.plugin_id}' not found`);
    }

    const reviews = pluginReviews.get(input.plugin_id) ?? [];

    // Check for existing review by same user
    const existingIdx = reviews.findIndex((r) => r.user_id === input.user_id);
    const review: PluginReview = {
      id: uuidv4(),
      plugin_id: input.plugin_id,
      user_id: input.user_id,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date(),
    };

    if (existingIdx >= 0) {
      reviews[existingIdx] = review;
    } else {
      reviews.push(review);
    }

    pluginReviews.set(input.plugin_id, reviews);

    // Recalculate average rating
    const ratings = reviews.map((r) => r.rating);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    listing.ratings = {
      average: Math.round(avgRating * 10) / 10,
      count: reviews.length,
    };

    logger.info(
      { pluginId: input.plugin_id, userId: input.user_id, rating: input.rating },
      '[PluginMarketplace] Review submitted'
    );

    return review;
  }

  /**
   * Get plugin quality score.
   */
  async getPluginQualityScore(pluginId: string): Promise<QualityScore> {
    const listing = pluginListings.get(pluginId);
    if (!listing) {
      throw new OrionError(ErrorCode.NOT_FOUND, 'Plugin not found');
    }

    const reviews = pluginReviews.get(pluginId) ?? [];

    // Calculate component scores based on various factors
    const securityScore = listing.verified ? 95 : 75;
    const reliabilityScore = listing.installedCount > 50 ? 90 : listing.installedCount > 10 ? 80 : 70;
    const maintainabilityScore = listing.repository_url ? 85 : 60;
    const documentationScore = listing.documentation_url ? 90 : listing.description.length > 100 ? 70 : 50;

    // Overall score is weighted average
    const overallScore = Math.round(
      securityScore * 0.3 +
        reliabilityScore * 0.25 +
        maintainabilityScore * 0.2 +
        documentationScore * 0.1 +
        listing.ratings.average * 20 * 0.15
    );

    return {
      pluginId,
      overallScore,
      securityScore,
      reliabilityScore,
      maintainabilityScore,
      documentationScore,
      reviewsCount: reviews.length,
      averageRating: listing.ratings.average,
    };
  }

  // ==================== Plugin Stats ====================

  /**
   * Get marketplace statistics.
   */
  async getPluginStats(): Promise<{
    totalPlugins: number;
    totalInstalls: number;
    averageRating: number;
    pluginsByCategory: Record<string, number>;
  }> {
    const plugins = Array.from(pluginListings.values());
    const allInstalls = Array.from(pluginInstalls.values()).flat();

    const categories: Record<string, number> = {};
    let totalRating = 0;

    for (const p of plugins) {
      categories[p.category] = (categories[p.category] ?? 0) + 1;
      totalRating += p.ratings.average;
    }

    return {
      totalPlugins: plugins.length,
      totalInstalls: allInstalls.length,
      averageRating: plugins.length > 0 ? Math.round((totalRating / plugins.length) * 10) / 10 : 0,
      pluginsByCategory: categories,
    };
  }

  // ==================== Plugin Uninstall ====================

  /**
   * Uninstall a plugin for a tenant.
   */
  async uninstallPlugin(tenantId: string, pluginId: string): Promise<boolean> {
    const installs = pluginInstalls.get(tenantId) ?? [];
    const idx = installs.findIndex((i) => i.plugin_id === pluginId && i.status === 'active');

    if (idx < 0) {
      return false;
    }

    installs[idx].status = 'uninstalled';
    pluginInstalls.set(tenantId, installs);

    // Update installed count
    const listing = pluginListings.get(pluginId);
    if (listing && listing.installedCount > 0) {
      listing.installedCount--;
    }

    logger.info({ pluginId, tenantId }, '[PluginMarketplace] Plugin uninstalled');

    // Persist to database
    if (this.pluginRepository) {
      try {
        await this.pluginRepository.updateState(pluginId, 'UNINSTALLED');
      } catch (error) {
        logger.warn({ error }, '[PluginMarketplace] Failed to update plugin state in DB');
      }
    }

    return true;
  }
}

export default PluginMarketplaceService;