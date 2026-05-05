/**
 * Plugin Marketplace Controller - Phase 3
 *
 * HTTP handlers for plugin marketplace endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
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

export class PluginMarketplaceController {
  private service: PluginMarketplaceService;
  private validator: PluginValidator;

  constructor(service: PluginMarketplaceService, validator?: PluginValidator) {
    this.service = service;
    this.validator = validator ?? new PluginValidator();
  }

  /**
   * POST /api/v1/plugins/marketplace - Publish a plugin
   */
  async publishPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const tenantId = (request as any).user?.tenantId || body.tenantId;

      if (!tenantId) {
        reply.status(400).send({ success: false, error: 'tenantId is required' });
        return;
      }

      const input: PublishPluginInput = {
        name: body.name,
        description: body.description,
        author: body.author,
        category: body.category,
        version: body.version,
        tags: body.tags,
        icon_url: body.icon_url,
        repository_url: body.repository_url,
        documentation_url: body.documentation_url,
        price_cents: body.price_cents,
      };

      // Validate required fields
      if (!input.name || !input.version || !input.description || !input.category) {
        reply.status(400).send({
          success: false,
          error: 'Missing required fields: name, version, description, category',
        });
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
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to publish plugin',
      });
    }
  }

  /**
   * GET /api/v1/plugins/marketplace - List plugins
   */
  async listPlugins(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;

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
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to list plugins',
      });
    }
  }

  /**
   * GET /api/v1/plugins/marketplace/:id - Get plugin details
   */
  async getPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const pluginId = params.id;

      const plugin = await this.service.getPlugin(pluginId);
      if (!plugin) {
        reply.status(404).send({
          success: false,
          error: 'Plugin not found',
        });
        return;
      }

      reply.send({
        success: true,
        data: plugin,
      });
    } catch (error: any) {
      reply.status(500).send({
        success: false,
        error: error.message || 'Failed to get plugin',
      });
    }
  }

  /**
   * POST /api/v1/plugins/marketplace/:id/install - Install a plugin
   */
  async installPlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;

      const tenantId = (request as any).user?.tenantId || body.tenantId;
      if (!tenantId) {
        reply.status(400).send({
          success: false,
          error: 'tenantId is required',
        });
        return;
      }

      const input: InstallPluginInput = {
        tenant_id: tenantId,
        plugin_id: params.id,
        version: body.version,
      };

      const install = await this.service.installPlugin(input);

      reply.status(201).send({
        success: true,
        data: install,
        message: 'Plugin installed successfully',
      });
    } catch (error: any) {
      reply.status(400).send({
        success: false,
        error: error.message || 'Failed to install plugin',
      });
    }
  }

  /**
   * POST /api/v1/plugins/marketplace/:id/rate - Rate a plugin
   */
  async ratePlugin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;

      const userId = (request as any).user?.id || body.userId;
      if (!userId) {
        reply.status(400).send({
          success: false,
          error: 'userId is required',
        });
        return;
      }

      if (!body.rating || body.rating < 1 || body.rating > 5) {
        reply.status(400).send({
          success: false,
          error: 'Rating must be between 1 and 5',
        });
        return;
      }

      const input: ReviewPluginInput = {
        plugin_id: params.id,
        user_id: userId,
        rating: parseInt(body.rating, 10),
        comment: body.comment,
      };

      const review = await this.service.reviewPlugin(input);

      reply.status(201).send({
        success: true,
        data: review,
        message: 'Review submitted successfully',
      });
    } catch (error: any) {
      reply.status(400).send({
        success: false,
        error: error.message || 'Failed to submit review',
      });
    }
  }

  /**
   * GET /api/v1/plugins/marketplace/:id/quality - Get plugin quality score
   */
  async getPluginQualityScore(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const pluginId = params.id;

      const score = await this.service.getPluginQualityScore(pluginId);

      reply.send({
        success: true,
        data: score,
      });
    } catch (error: any) {
      if (error.message === 'Plugin not found') {
        reply.status(404).send({
          success: false,
          error: 'Plugin not found',
        });
      } else {
        reply.status(500).send({
          success: false,
          error: error.message || 'Failed to get quality score',
        });
      }
    }
  }
}
