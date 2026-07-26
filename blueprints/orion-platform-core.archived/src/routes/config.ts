import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as ApiKeyService from '../services/ApiKeyService.js';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  // ==================== System Config ====================

  app.get('/configs', {
    schema: {
      tags: ['Config'],
      description: 'List system configurations',
      querystring: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['global', 'tenant', 'project'] },
          tenantId: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Querystring: {
        scope?: string;
        tenantId?: string;
        projectId?: string;
        page?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);

    const { configs, total } = await (await import('../services/ConfigService.js')).listConfigs({
      scope: request.query.scope,
      tenantId: request.query.tenantId,
      projectId: request.query.projectId,
      page,
      limit,
    });

    reply.send({
      success: true,
      data: configs,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });

  app.post('/configs', {
    schema: {
      tags: ['Config'],
      description: 'Create a system configuration',
      body: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          scope: { type: 'string', enum: ['global', 'tenant', 'project'] },
          tenantId: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          encrypted: { type: 'boolean' },
          description: { type: 'string' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Body: {
        key: string;
        value: string;
        scope?: 'global' | 'tenant' | 'project';
        tenantId?: string;
        projectId?: string;
        encrypted?: boolean;
        description?: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { createConfig } = await import('../services/ConfigService.js');
    const config = await createConfig(request.body);
    reply.code(201).send({ success: true, data: config });
  });

  app.get('/configs/:key', {
    schema: {
      tags: ['Config'],
      description: 'Get a config by key',
    },
  }, async (
    request: FastifyRequest<{ Params: { key: string }; Querystring: { scope?: string; tenantId?: string; projectId?: string } }>,
    reply: FastifyReply,
  ) => {
    const { getConfig } = await import('../services/ConfigService.js');
    const config = await getConfig(request.params.key, request.query.scope, request.query.tenantId, request.query.projectId);
    if (!config) {
      return reply.code(404).send({ success: false, error: { code: 'CONFIG_NOT_FOUND', message: 'Config not found' } });
    }
    reply.send({ success: true, data: config });
  });

  app.patch('/configs/:id', {
    schema: {
      tags: ['Config'],
      description: 'Update a config',
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string }; Body: { value: string; description?: string } }>,
    reply: FastifyReply,
  ) => {
    const { updateConfig } = await import('../services/ConfigService.js');
    const config = await updateConfig(request.params.id, request.body);
    if (!config) {
      return reply.code(404).send({ success: false, error: { code: 'CONFIG_NOT_FOUND', message: 'Config not found' } });
    }
    reply.send({ success: true, data: config });
  });

  app.delete('/configs/:id', {
    schema: {
      tags: ['Config'],
      description: 'Delete a config',
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { deleteConfig } = await import('../services/ConfigService.js');
    const success = await deleteConfig(request.params.id);
    if (!success) {
      return reply.code(404).send({ success: false, error: { code: 'CONFIG_NOT_FOUND', message: 'Config not found' } });
    }
    reply.send({ success: true });
  });

  // ==================== API Keys ====================

  app.get('/api-keys', {
    schema: {
      tags: ['API Keys'],
      description: 'List API keys',
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Querystring: {
        tenantId?: string;
        projectId?: string;
        page?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const page = parseInt(request.query.page || '1', 10);
    const limit = parseInt(request.query.limit || '20', 10);

    const { apiKeys, total } = await ApiKeyService.listApiKeys({
      tenantId: request.query.tenantId,
      projectId: request.query.projectId,
      page,
      limit,
    });

    reply.send({
      success: true,
      data: apiKeys,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });

  app.post('/api-keys', {
    schema: {
      tags: ['API Keys'],
      description: 'Create a new API key',
      body: {
        type: 'object',
        required: ['name', 'scopes'],
        properties: {
          name: { type: 'string' },
          tenantId: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          scopes: { type: 'array', items: { type: 'string' } },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (
    request: FastifyRequest<{
      Body: {
        name: string;
        tenantId?: string;
        projectId?: string;
        scopes: string[];
        expiresAt?: Date;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const apiKey = await ApiKeyService.createApiKey(request.body);
    reply.code(201).send({ success: true, data: apiKey });
  });

  app.delete('/api-keys/:id', {
    schema: {
      tags: ['API Keys'],
      description: 'Revoke an API key',
    },
  }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const success = await ApiKeyService.revokeApiKey(request.params.id);
    if (!success) {
      return reply.code(404).send({ success: false, error: { code: 'API_KEY_NOT_FOUND', message: 'API key not found' } });
    }
    reply.send({ success: true });
  });
}
