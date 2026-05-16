/**
 * Cross-Domain Workflow API Routes
 *
 * Prefix: /api/v1/workflows
 *
 * Endpoints:
 * - POST /api/v1/workflows - Create workflow
 * - GET /api/v1/workflows - List workflows
 * - GET /api/v1/workflows/:id - Get workflow
 * - POST /api/v1/workflows/:id/execute - Execute workflow
 * - GET /api/v1/workflows/:id/executions - List executions
 * - GET /api/v1/workflows/executions/:executionId - Get execution
 * - POST /api/v1/workflows/:id/pause - Pause workflow
 * - POST /api/v1/workflows/:id/resume - Resume workflow
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CrossDomainOrchestrator, CreateWorkflowInput } from '../services/CrossDomainOrchestrator';

// Route options interface
interface WorkflowRoutesOptions {}

// Request body types
interface CreateWorkflowBody {
  name: string;
  description: string;
  steps: CreateWorkflowInput['steps'];
  triggers: CreateWorkflowInput['triggers'];
}

interface ExecuteWorkflowBody {
  triggeredBy?: string;
  initialInput?: Record<string, unknown>;
}

// URL parameter types
interface WorkflowParams {
  id: string;
}

interface ExecutionParams {
  executionId: string;
}

interface ListQuery {
  status?: 'active' | 'paused' | 'completed' | 'failed';
  domain?: string;
  limit?: number;
  offset?: number;
}

export default async function workflowRoutes(
  app: FastifyInstance,
  options: WorkflowRoutesOptions
): Promise<void> {
  // Initialize orchestrator
  const orchestrator = new CrossDomainOrchestrator();

  // POST /api/v1/workflows - Create workflow
  app.post<{ Body: CreateWorkflowBody }>(
    '/v1/workflows',
    async (request: FastifyRequest<{ Body: CreateWorkflowBody }>, reply: FastifyReply) => {
      try {
        const { name, description, steps, triggers } = request.body;

        if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'name and steps are required',
          });
        }

        const input: CreateWorkflowInput = {
          name,
          description: description || '',
          steps,
          triggers: triggers || [],
        };

        const workflow = await orchestrator.createWorkflow(input);
        return reply.status(201).send(workflow);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ error: 'Internal Server Error', message });
      }
    }
  );

  // GET /api/v1/workflows - List workflows
  app.get<{ Querystring: ListQuery }>(
    '/v1/workflows',
    async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
      try {
        const { status, domain, limit, offset } = request.query;
        const filter = { status, domain, limit, offset };
        const workflows = await orchestrator.listWorkflows(filter);
        return reply.send(workflows);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ error: 'Internal Server Error', message });
      }
    }
  );

  // GET /api/v1/workflows/:id - Get workflow
  app.get<{ Params: WorkflowParams }>(
    '/v1/workflows/:id',
    async (request: FastifyRequest<{ Params: WorkflowParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const workflow = await orchestrator.getWorkflow(id);

        if (!workflow) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Workflow '${id}' not found`,
          });
        }

        return reply.send(workflow);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ error: 'Internal Server Error', message });
      }
    }
  );

  // POST /api/v1/workflows/:id/execute - Execute workflow
  app.post<{ Params: WorkflowParams; Body: ExecuteWorkflowBody }>(
    '/v1/workflows/:id/execute',
    async (
      request: FastifyRequest<{ Params: WorkflowParams; Body: ExecuteWorkflowBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { triggeredBy = 'system', initialInput } = request.body || {};

        const execution = await orchestrator.executeWorkflow(id, triggeredBy, initialInput);
        return reply.status(201).send(execution);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = message.includes('not found') ? 404 : 400;
        return reply.status(statusCode).send({ error: 'Execution Error', message });
      }
    }
  );

  // GET /api/v1/workflows/:id/executions - List executions
  app.get<{ Params: WorkflowParams }>(
    '/v1/workflows/:id/executions',
    async (request: FastifyRequest<{ Params: WorkflowParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const executions = await orchestrator.listExecutions(id);
        return reply.send(executions);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ error: 'Internal Server Error', message });
      }
    }
  );

  // GET /api/v1/workflows/executions/:executionId - Get execution
  app.get<{ Params: ExecutionParams }>(
    '/v1/workflows/executions/:executionId',
    async (request: FastifyRequest<{ Params: ExecutionParams }>, reply: FastifyReply) => {
      try {
        const { executionId } = request.params;
        const execution = await orchestrator.getExecution(executionId);

        if (!execution) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Execution '${executionId}' not found`,
          });
        }

        return reply.send(execution);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({ error: 'Internal Server Error', message });
      }
    }
  );

  // POST /api/v1/workflows/:id/pause - Pause workflow
  app.post<{ Params: WorkflowParams }>(
    '/v1/workflows/:id/pause',
    async (request: FastifyRequest<{ Params: WorkflowParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const result = await orchestrator.pauseWorkflow(id);

        if (!result) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Workflow '${id}' not found`,
          });
        }

        const workflow = await orchestrator.getWorkflow(id);
        return reply.send(workflow);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({ error: 'Bad Request', message });
      }
    }
  );

  // POST /api/v1/workflows/:id/resume - Resume workflow
  app.post<{ Params: WorkflowParams }>(
    '/v1/workflows/:id/resume',
    async (request: FastifyRequest<{ Params: WorkflowParams }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const result = await orchestrator.resumeWorkflow(id);

        if (!result) {
          return reply.status(404).send({
            error: 'Not Found',
            message: `Workflow '${id}' not found`,
          });
        }

        const workflow = await orchestrator.getWorkflow(id);
        return reply.send(workflow);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({ error: 'Bad Request', message });
      }
    }
  );
}