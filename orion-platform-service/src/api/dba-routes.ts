/**
 * DBA Service API Routes
 *
 * Proxy endpoints for DBA Service (orion-dba-svc)
 * Currently proxies to the standalone DBA service at port 3031
 *
 * Prefix: /api/v1/dba
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface DbaProxyConfig {
  dbaServiceUrl: string;
  apiKey?: string;
}

const config: DbaProxyConfig = {
  dbaServiceUrl: process.env.DBA_SERVICE_URL || 'http://localhost:3031',
  apiKey: process.env.DBA_SERVICE_API_KEY,
};

async function proxyToDbaService(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<unknown> {
  const url = `${config.dbaServiceUrl}/api/v1/dba${path}`;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (config.apiKey) {
    requestHeaders['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DBA Service error (${response.status}): ${error}`);
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

export default async function dbaRoutes(app: FastifyInstance): Promise<void> {
  // ==================== SQL Orders ====================

  // POST /dba/orders - Create SQL order
  app.post('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const userId = request.headers['x-user-id'] as string;

    if (!tenantId || !userId) {
      return reply.code(400).send({ error: 'x-tenant-id and x-user-id headers are required' });
    }

    try {
      const result = await proxyToDbaService('POST', '/orders', request.body, {
        'x-tenant-id': tenantId,
        'x-user-id': userId,
      });
      return reply.code(201).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to create order', details: message });
    }
  });

  // GET /dba/orders - List SQL orders
  app.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const query = request.query as Record<string, string>;

    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id header is required' });
    }

    try {
      const queryString = new URLSearchParams({ tenantId, ...query }).toString();
      const result = await proxyToDbaService('GET', `/orders?${queryString}`, undefined, {
        'x-tenant-id': tenantId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to list orders', details: message });
    }
  });

  // GET /dba/orders/:id - Get SQL order by ID
  app.get('/orders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await proxyToDbaService('GET', `/orders/${id}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('404')) {
        return reply.code(404).send({ error: 'Order not found' });
      }
      return reply.code(502).send({ error: 'Failed to get order', details: message });
    }
  });

  // POST /dba/orders/:id/approve - Approve SQL order
  app.post('/orders/:id/approve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.headers['x-user-id'] as string;

    if (!userId) {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      const result = await proxyToDbaService('POST', `/orders/${id}/approve`, {}, {
        'x-user-id': userId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to approve order', details: message });
    }
  });

  // POST /dba/orders/:id/reject - Reject SQL order
  app.post('/orders/:id/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.headers['x-user-id'] as string;
    const body = request.body as { reason?: string };

    if (!userId) {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      const result = await proxyToDbaService('POST', `/orders/${id}/reject`, { reason: body.reason }, {
        'x-user-id': userId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to reject order', details: message });
    }
  });

  // POST /dba/orders/:id/execute - Execute SQL order
  app.post('/orders/:id/execute', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = request.headers['x-user-id'] as string;

    if (!userId) {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      const result = await proxyToDbaService('POST', `/orders/${id}/execute`, { executedBy: userId }, {
        'x-user-id': userId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to execute order', details: message });
    }
  });

  // ==================== Data Sources ====================

  // GET /dba/sources - List data sources
  app.get('/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id header is required' });
    }

    try {
      const result = await proxyToDbaService('GET', '/sources', undefined, {
        'x-tenant-id': tenantId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to list sources', details: message });
    }
  });

  // POST /dba/sources - Create data source
  app.post('/sources', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id header is required' });
    }

    try {
      const result = await proxyToDbaService('POST', '/sources', request.body, {
        'x-tenant-id': tenantId,
      });
      return reply.code(201).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to create source', details: message });
    }
  });

  // PUT /dba/sources/:id - Update data source
  app.put('/sources/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await proxyToDbaService('PUT', `/sources/${id}`, request.body);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to update source', details: message });
    }
  });

  // DELETE /dba/sources/:id - Delete data source
  app.delete('/sources/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      await proxyToDbaService('DELETE', `/sources/${id}`);
      return reply.code(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to delete source', details: message });
    }
  });

  // POST /dba/sources/:id/test - Test data source connection
  app.post('/sources/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await proxyToDbaService('POST', `/sources/${id}/test`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to test connection', details: message });
    }
  });

  // ==================== Audit Rules ====================

  // GET /dba/rules - List audit rules
  app.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id header is required' });
    }

    try {
      const result = await proxyToDbaService('GET', '/rules', undefined, {
        'x-tenant-id': tenantId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to list rules', details: message });
    }
  });

  // POST /dba/rules - Create audit rule
  app.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return reply.code(400).send({ error: 'x-tenant-id header is required' });
    }

    try {
      const result = await proxyToDbaService('POST', '/rules', request.body, {
        'x-tenant-id': tenantId,
      });
      return reply.code(201).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to create rule', details: message });
    }
  });

  // PUT /dba/rules/:id - Update audit rule
  app.put('/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await proxyToDbaService('PUT', `/rules/${id}`, request.body);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to update rule', details: message });
    }
  });

  // ==================== User Permissions ====================

  // GET /dba/permissions - Get user permissions
  app.get('/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.headers['x-user-id'] as string;
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!userId || !tenantId) {
      return reply.code(400).send({ error: 'x-user-id and x-tenant-id headers are required' });
    }

    try {
      const result = await proxyToDbaService('GET', '/permissions', undefined, {
        'x-user-id': userId,
        'x-tenant-id': tenantId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to get permissions', details: message });
    }
  });

  // PUT /dba/permissions - Update user permissions
  app.put('/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.headers['x-user-id'] as string;
    const tenantId = request.headers['x-tenant-id'] as string;

    if (!userId || !tenantId) {
      return reply.code(400).send({ error: 'x-user-id and x-tenant-id headers are required' });
    }

    try {
      const result = await proxyToDbaService('PUT', '/permissions', request.body, {
        'x-user-id': userId,
        'x-tenant-id': tenantId,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to update permissions', details: message });
    }
  });

  // ==================== SQL Query ====================

  // POST /dba/query - Execute ad-hoc SQL query
  app.post('/query', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { sourceId: string; sql: string; limit?: number };

    if (!body.sourceId || !body.sql) {
      return reply.code(400).send({ error: 'sourceId and sql are required' });
    }

    try {
      const result = await proxyToDbaService('POST', '/query', body);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(502).send({ error: 'Failed to execute query', details: message });
    }
  });
}