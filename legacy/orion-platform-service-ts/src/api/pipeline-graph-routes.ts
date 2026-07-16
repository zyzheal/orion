/**
 * Pipeline Graph API Routes
 *
 * Provides YAML <-> JSON graph conversion and validation APIs
 * for the frontend DAG visual editor.
 *
 * Routes:
 *   GET  /api/v1/pipelines/:id/graph     - Build graph from saved pipeline
 *   POST /api/v1/pipelines/parse-yaml    - YAML to JSON graph
 *   POST /api/v1/pipelines/to-yaml       - JSON graph to YAML
 *   POST /api/v1/pipelines/validate      - Validate YAML spec
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PipelineGraphBuilder } from '../services/pipeline/PipelineGraphBuilder';
import { YamlConverter } from '../services/pipeline/YamlConverter';
import { PipelineValidator } from '../services/pipeline/PipelineValidator';
import { PipelineService } from '../services/pipeline/PipelineService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { OrionError, ValidationError, NotFoundError, ErrorCode, handleError } from '../errors';

export interface PipelineGraphRouteDeps {
  pipelineService: PipelineService;
}

export async function registerPipelineGraphRoutes(
  app: FastifyInstance,
  deps: PipelineGraphRouteDeps
): Promise<void> {
  const graphBuilder = new PipelineGraphBuilder();
  const yamlConverter = new YamlConverter();
  const validator = new PipelineValidator();

  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('onRequest', authenticateUser);

    // ==================== GET /api/v1/pipelines/:id/graph ====================
    // Build graph from a saved pipeline's yamlDefinition
    instance.get(
      '/v1/pipelines/:id/graph',
      {
        onRequest: [requirePermission({ resource: 'pipeline', action: 'read' })],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const params = request.params as { id: string };
          const pipeline = await deps.pipelineService.getById(params.id);

          if (!pipeline) {
            return handleError(reply, new NotFoundError('NOT_FOUND'))
          }

          if (!pipeline.yamlDefinition) {
            return handleError(reply, new ValidationError('NO_YAML_DEFINITION'))
          }

          const graph = graphBuilder.buildGraph(params.id, pipeline.yamlDefinition);

          return reply.send({
            pipelineId: params.id,
            pipelineName: pipeline.name,
            graph,
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== POST /api/v1/pipelines/parse-yaml ====================
    // Convert YAML to JSON graph format
    instance.post(
      '/v1/pipelines/parse-yaml',
      {
        onRequest: [requirePermission({ resource: 'pipeline', action: 'write' })],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as any;

          if (!body?.yamlDefinition) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'))
          }

          const result = yamlConverter.yamlToJson(body.yamlDefinition);

          return reply.send({
            graph: result.graph,
            valid: result.validation.valid,
            errors: result.validation.errors,
            warnings: result.validation.warnings,
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== POST /api/v1/pipelines/to-yaml ====================
    // Convert JSON graph back to YAML pipeline spec
    instance.post(
      '/v1/pipelines/to-yaml',
      {
        onRequest: [requirePermission({ resource: 'pipeline', action: 'write' })],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as any;

          if (!body?.graph) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'))
          }

          const { pipelineId, nodes, edges } = body.graph;

          if (!nodes || !Array.isArray(nodes)) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'))
          }

          const result = yamlConverter.jsonToYaml({
            pipelineId: pipelineId || 'pipeline',
            nodes,
            edges: edges || [],
          });

          return reply.send({
            yaml: result.yaml,
            valid: result.validation.valid,
            errors: result.validation.errors,
            warnings: result.validation.warnings,
          });
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );

    // ==================== POST /api/v1/pipelines/validate ====================
    // Validate a pipeline YAML spec (enhanced validation)
    instance.post(
      '/v1/pipelines/validate',
      {
        onRequest: [requirePermission({ resource: 'pipeline', action: 'write' })],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as any;

          if (!body?.yamlDefinition) {
            return handleError(reply, new ValidationError('VALIDATION_ERROR'))
          }

          const result = validator.validate(body.yamlDefinition);

          return reply.send(result);
        } catch (error: any) {
          return handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
        }
      }
    );
  });
}
