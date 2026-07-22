/**
 * Plugin Marketplace Controller - Phase 3
 *
 * HTTP handlers for plugin marketplace endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';
import {
  PluginMarketplaceService,
  ListPluginsFilter,
  PublishPluginInput,
  InstallPluginInput,
  ReviewPluginInput,
} from '../../services/plugin-marketplace/PluginMarketplaceService';
import {
  PluginValidator,
  PluginPackage,
} from '../../services/plugin-marketplace/PluginValidator';

// --- Request body interfaces ---

interface PublishPluginBody {
  name?: string;
  description?: string;
  author?: string;
  category?: string;
  version?: string;
  tags?: string[];
  icon_url?: string;
  repository_url?: string;
  documentation_url?: string;
  price_cents?: number;
  code?: string;
  main?: string;
  dependencies?: Record<string, string>;
  platform_api_version?: string;
  permissions?: string[];
  config_schema?: Record<string, unknown>;
  tenantId?: string;
}

interface InstallPluginBody {
  version?: string;
  tenantId?: string;
}

interface ReviewPluginBody {
  rating?: number | string;
  comment?: string;
  userId?: string;
}

// --- Query / params interfaces ---

interface ListPluginsQuery extends Record<string, string | undefined> {
  category?: string;
  verified?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

interface PluginIdParams extends Record<string, string> {
  id: string;
}

export class PluginMarketplaceController extends BaseController {
  private service: PluginMarketplaceService;
  private validator: PluginValidator;

  constructor(service: PluginMarketplaceService, validator?: PluginValidator) {
    super();
    this.service = service;
    this.validator = validator ?? new PluginValidator();
  }

  /**
   * POST /api/v1/plugins/marketplace - Publish a plugin
   */
  async publishPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = this.getBody<PublishPluginBody>(request);
      const tenantId = this.getTenantId(request) || body.tenantId;

      if (!tenantId) {
        this.sendBadRequest(reply, 'tenantId is required');
        return;
      }

      const input: PublishPluginInput = {
        name: body.name ?? '',
        description: body.description ?? '',
        author: body.author ?? '',
        category: body.category ?? '',
        version: body.version ?? '',
        tags: body.tags ?? [],
        icon_url: body.icon_url,
        repository_url: body.repository_url,
        documentation_url: body.documentation_url,
        price_cents: body.price_cents,
      };

      // Validate required fields
      if (!input.name || !input.version || !input.description || !input.category) {
        this.sendBadRequest(reply, 'Missing required fields: name, version, description, category');
        return;
      }

      // If code is provided, validate it
      if (body.code) {
        const packageData: PluginPackage = {
          name: input.name,
          version: input.version,
          description: input.description,
          author: input.author,
          category: input.category,
          main: body.main || 'index.js',
          code: body.code,
          dependencies: body.dependencies,
          platform_api_version: body.platform_api_version,
          permissions: body.permissions,
          config_schema: body.config_schema,
        };

        const validationResult = this.validator.validatePlugin(packageData);
        if (!validationResult.valid) {
          reply.status(400).send({
            success: false,
            error: 'Plugin validation failed',
            validationErrors: validationResult.errors,
            warnings: validationResult.warnings,
            securityRisk: validationResult.securityRisk,
          });
          return;
        }

        // Include warnings in response
        if (validationResult.warnings.length > 0) {
          // Could store this or just return as warning
        }
      }

      const plugin = await this.service.publishPlugin(tenantId, input);

      reply.status(201).send({
        success: true,
        data: plugin,
        message: 'Plugin published successfully',
      });
    } catch (error: unknown) {
      this.handleError(reply, error);
    }
  }

  /**
   * GET /api/v1/plugins/marketplace - List plugins
   */
  async listPlugins(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = this.getQuery<ListPluginsQuery>(request);

      const filter: ListPluginsFilter = {
        category: query.category,
        verified: query.verified !== undefined ? query.verified === 'true' : undefined,
        search: query.search,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      };

      const result = await this.service.listPlugins(filter);

      reply.send({
        success: true,
        data: result.data,
        total: result.total,
        limit: filter.limit ?? 50,
        offset: filter.offset ?? 0,
      });
    } catch (error: unknown) {
      this.handleError(reply, error);
    }
  }

  /**
   * GET /api/v1/plugins/marketplace/:id - Get plugin details
   */
  async getPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = this.getParams<PluginIdParams>(request);
      const pluginId = params.id;

      const plugin = await this.service.getPlugin(pluginId);
      if (!plugin) {
        this.sendNotFound(reply, 'Plugin', pluginId);
        return;
      }

      reply.send({
        success: true,
        data: plugin,
      });
    } catch (error: unknown) {
      this.handleError(reply, error);
    }
  }

  /**
   * POST /api/v1/plugins/marketplace/:id/install - Install a plugin
   */
  async installPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = this.getParams<PluginIdParams>(request);
      const body = this.getBody<InstallPluginBody>(request);

      const tenantId = this.getTenantId(request) || body.tenantId;
      if (!tenantId) {
        this.sendBadRequest(reply, 'tenantId is required');
        return;
      }

      const input: InstallPluginInput = {
        tenant_id: tenantId,
        plugin_id: params.id,
        version: body.version,
      };

      const install = await this.service.installPlugin(input, tenantId);

      reply.status(201).send({
        success: true,
        data: install,
        message: 'Plugin installed successfully',
      });
    } catch (error: unknown) {
      this.handleError(reply, error);
    }
  }

  /**
   * POST /api/v1/plugins/marketplace/:id/rate - Rate a plugin
   */
  async ratePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = this.getParams<PluginIdParams>(request);
      const body = this.getBody<ReviewPluginBody>(request);

      const userId = this.getUser(request)?.userId || body.userId;
      if (!userId) {
        this.sendBadRequest(reply, 'userId is required');
        return;
      }

      const rating = typeof body.rating === 'string' ? parseInt(body.rating, 10) : (body.rating ?? 0);
      if (!body.rating || rating < 1 || rating > 5) {
        this.sendBadRequest(reply, 'Rating must be between 1 and 5');
        return;
      }

      const input: ReviewPluginInput = {
        plugin_id: params.id,
        user_id: userId,
        rating,
        comment: body.comment,
      };

      const review = await this.service.reviewPlugin(input);

      reply.status(201).send({
        success: true,
        data: review,
        message: 'Review submitted successfully',
      });
    } catch (error: unknown) {
      this.handleError(reply, error);
    }
  }

  /**
   * GET /api/v1/plugins/marketplace/:id/quality - Get plugin quality score
   */
  async getPluginQualityScore(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = this.getParams<PluginIdParams>(request);

      const score = await this.service.getPluginQualityScore(params.id);

      reply.send({
        success: true,
        data: score,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Plugin not found') {
        const params = this.getParams<PluginIdParams>(request);
        this.sendNotFound(reply, 'Plugin', params.id);
      } else {
        this.handleError(reply, error);
      }
    }
  }
}
