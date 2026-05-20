/**
 * Lowcode Workflow API Routes
 *
 * Prefix: /v1/workflows (handled by register)
 *
 * Endpoints:
 * - GET /v1/workflows - List workflows
 * - GET /v1/workflows/:id - Get workflow
 * - POST /v1/workflows - Create workflow
 * - PUT /v1/workflows/:id - Update workflow
 * - DELETE /v1/workflows/:id - Delete workflow
 * - POST /v1/workflows/:id/execute - Execute workflow
 * - GET /v1/workflows/:id/executions - List executions
 * - GET /v1/workflows/executions/:executionId - Get execution detail
 * - POST /v1/workflows/:id/pause - Pause workflow
 * - POST /v1/workflows/:id/resume - Resume workflow
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { randomUUID } from 'crypto';

interface WorkflowRoutesOptions {
  database?: DatabasePool;
}

interface CreateWorkflowBody {
  name: string;
  description?: string;
  steps: Array<{
    id: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
  }>;
  triggers?: string[];
}

interface UpdateWorkflowBody {
  name?: string;
  description?: string;
  nodes?: unknown[];
  edges?: unknown[];
  enabled?: boolean;
}

interface ExecuteWorkflowBody {
  triggeredBy?: string;
  initialInput?: Record<string, unknown>;
}

export default async function workflowRoutes(
  app: FastifyInstance,
  options: WorkflowRoutesOptions
): Promise<void> {
  const db = options.database;

  if (!db) {
    app.log.warn('workflowRoutes: database not provided, workflow APIs will be disabled');
    return;
  }

  // ==================== GET /v1/workflows - List workflows ====================
  app.get(
    '/',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'read' })],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { status, limit = 50, offset = 0 } = request.query as Record<string, any>;

        let query = 'SELECT * FROM lowcode_workflow_definition WHERE 1=1';
        const params: any[] = [];

        if (status === 'active') {
          query += ' AND enabled = $' + (params.length + 1);
          params.push(true);
        } else if (status === 'paused') {
          query += ' AND enabled = $' + (params.length + 1);
          params.push(false);
        }

        query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
        params.push(limit);
        query += ' OFFSET $' + (params.length + 1);
        params.push(offset);

        const workflows = await db.query(query, params);
        return reply.send({ success: true, data: workflows.rows });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== GET /v1/workflows/:id - Get workflow ====================
  app.get(
    '/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'read' })],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const result = await db.query(
          'SELECT * FROM lowcode_workflow_definition WHERE id = $1',
          [id]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ success: false, error: 'Workflow not found' });
        }

        return reply.send({ success: true, data: result.rows[0] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== POST /v1/workflows - Create workflow ====================
  app.post(
    '/',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
    },
    async (
      request: FastifyRequest<{ Body: CreateWorkflowBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { name, description, steps } = request.body;

        if (!name) {
          return reply.status(400).send({ success: false, error: 'name is required' });
        }

        // Build nodes and edges from steps
        const nodes = (steps || []).map((step, idx) => ({
          id: step.id || `node-${idx + 1}`,
          type: step.type,
          name: step.name,
          position: { x: 20 + idx * 230, y: 100 },
          config: step.config || {},
        }));

        const edges: Array<{ id: string; source: string; target: string }> = [];
        for (let i = 0; i < nodes.length - 1; i++) {
          edges.push({
            id: `edge-${i + 1}`,
            source: nodes[i].id,
            target: nodes[i + 1].id,
          });
        }

        const workflowId = randomUUID();
        const result = await db.query(
          `INSERT INTO lowcode_workflow_definition (id, name, description, nodes, edges, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [workflowId, name, description || '', JSON.stringify(nodes), JSON.stringify(edges), 'system']
        );

        return reply.status(201).send({ success: true, data: result.rows[0] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== PUT /v1/workflows/:id - Update workflow ====================
  app.put(
    '/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateWorkflowBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { name, description, nodes, edges, enabled } = request.body;

        const updates: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        if (name !== undefined) {
          updates.push(`name = $${paramIdx++}`);
          params.push(name);
        }
        if (description !== undefined) {
          updates.push(`description = $${paramIdx++}`);
          params.push(description);
        }
        if (nodes !== undefined) {
          updates.push(`nodes = $${paramIdx++}`);
          params.push(JSON.stringify(nodes));
        }
        if (edges !== undefined) {
          updates.push(`edges = $${paramIdx++}`);
          params.push(JSON.stringify(edges));
        }
        if (enabled !== undefined) {
          updates.push(`enabled = $${paramIdx++}`);
          params.push(enabled);
        }

        if (updates.length === 0) {
          return reply.status(400).send({ success: false, error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const result = await db.query(
          `UPDATE lowcode_workflow_definition SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
          params
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ success: false, error: 'Workflow not found' });
        }

        return reply.send({ success: true, data: result.rows[0] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== DELETE /v1/workflows/:id - Delete workflow ====================
  app.delete(
    '/:id',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const result = await db.query(
          'DELETE FROM lowcode_workflow_definition WHERE id = $1 RETURNING id',
          [id]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ success: false, error: 'Workflow not found' });
        }

        return reply.send({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== POST /v1/workflows/:id/pause - Pause workflow ====================
  app.post(
    '/:id/pause',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const result = await db.query(
          'UPDATE lowcode_workflow_definition SET enabled = false, updated_at = NOW() WHERE id = $1 RETURNING *',
          [id]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ success: false, error: 'Workflow not found' });
        }

        return reply.send({ success: true, data: result.rows[0] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== POST /v1/workflows/:id/resume - Resume workflow ====================
  app.post(
    '/:id/resume',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'write' })],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const result = await db.query(
          'UPDATE lowcode_workflow_definition SET enabled = true, updated_at = NOW() WHERE id = $1 RETURNING *',
          [id]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ success: false, error: 'Workflow not found' });
        }

        return reply.send({ success: true, data: result.rows[0] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== POST /v1/workflows/:id/execute - Execute workflow ====================
  app.post(
    '/:id/execute',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'execute' })],
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: ExecuteWorkflowBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { triggeredBy = 'system', initialInput = {} } = request.body || {};

        // Check workflow exists and enabled
        const wf = await db.query(
          'SELECT * FROM lowcode_workflow_definition WHERE id = $1',
          [id]
        );

        if (wf.rows.length === 0) {
          return reply.status(404).send({ success: false, error: 'Workflow not found' });
        }

        if (!wf.rows[0].enabled) {
          return reply.status(400).send({ success: false, error: 'Workflow is not enabled' });
        }

        // Create execution instance
        const instanceId = `exec-${Date.now()}`;
        const result = await db.query(
          `INSERT INTO lowcode_workflow_instance (id, workflow_id, workflow_definition_id, status, input, current_node_id)
           VALUES ($1, $2, $3, 'running', $4, $5) RETURNING *`,
          [instanceId, id, id, JSON.stringify(initialInput), null]
        );

        return reply.status(201).send({ success: true, data: result.rows[0] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== GET /v1/workflows/:id/executions - List executions ====================
  app.get(
    '/:id/executions',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'read' })],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const result = await db.query(
          "SELECT * FROM lowcode_workflow_instance WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT 50",
          [id]
        );

        return reply.send({ success: true, data: result.rows });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );

  // ==================== GET /v1/workflows/executions/:executionId - Get execution detail ====================
  app.get(
    '/executions/:executionId',
    {
      onRequest: [authenticateUser, requirePermission({ resource: 'workflow', action: 'read' })],
    },
    async (
      request: FastifyRequest<{ Params: { executionId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { executionId } = request.params;
        const result = await db.query(
          'SELECT * FROM lowcode_workflow_instance WHERE id = $1',
          [executionId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ success: false, error: 'Execution not found' });
        }

        return reply.send({ success: true, data: result.rows[0] });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ success: false, error: message });
      }
    }
  );
}
