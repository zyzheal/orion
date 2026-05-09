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
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const params = request.params as { id: string };
          const pipeline = await deps.pipelineService.getById(params.id);

          if (!pipeline) {
            return reply.status(404).send({
              error: 'NOT_FOUND',
              code: '30201',
              message: `Pipeline '${params.id}' not found`,
            });
          }

          if (!pipeline.yamlDefinition) {
            return reply.status(400).send({
              error: 'NO_YAML_DEFINITION',
              code: '30105',
              message: 'Pipeline has no YAML definition',
            });
          }

          const graph = graphBuilder.buildGraph(params.id, pipeline.yamlDefinition);

          return reply.send({
            pipelineId: params.id,
            pipelineName: pipeline.name,
            graph,
          });
        } catch (error: any) {
          return reply.status(500).send({
            error: 'INTERNAL_ERROR',
            code: '50000',
            message: error.message || 'Failed to build pipeline graph',
          });
        }
      }
    );

    // ==================== POST /api/v1/pipelines/parse-yaml ====================
    // Convert YAML to JSON graph format
    instance.post(
      '/v1/pipelines/parse-yaml',
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as any;

          if (!body?.yamlDefinition) {
            return reply.status(400).send({
              error: 'VALIDATION_ERROR',
              code: '30101',
              message: 'Missing yamlDefinition in request body',
            });
          }

          const result = yamlConverter.yamlToJson(body.yamlDefinition);

          return reply.send({
            graph: result.graph,
            valid: result.validation.valid,
            errors: result.validation.errors,
            warnings: result.validation.warnings,
          });
        } catch (error: any) {
          return reply.status(500).send({
            error: 'INTERNAL_ERROR',
            code: '50000',
            message: error.message || 'Failed to parse YAML',
          });
        }
      }
    );

    // ==================== POST /api/v1/pipelines/to-yaml ====================
    // Convert JSON graph back to YAML pipeline spec
    instance.post(
      '/v1/pipelines/to-yaml',
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as any;

          if (!body?.graph) {
            return reply.status(400).send({
              error: 'VALIDATION_ERROR',
              code: '30101',
              message: 'Missing graph in request body',
            });
          }

          const { pipelineId, nodes, edges } = body.graph;

          if (!nodes || !Array.isArray(nodes)) {
            return reply.status(400).send({
              error: 'VALIDATION_ERROR',
              code: '30101',
              message: 'graph.nodes must be an array',
            });
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
          return reply.status(500).send({
            error: 'INTERNAL_ERROR',
            code: '50000',
            message: error.message || 'Failed to convert to YAML',
          });
        }
      }
    );

    // ==================== POST /api/v1/pipelines/validate ====================
    // Validate a pipeline YAML spec (enhanced validation)
    instance.post(
      '/v1/pipelines/validate',
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          const body = request.body as any;

          if (!body?.yamlDefinition) {
            return reply.status(400).send({
              error: 'VALIDATION_ERROR',
              code: '30101',
              message: 'Missing yamlDefinition in request body',
            });
          }

          const result = validator.validate(body.yamlDefinition);

          return reply.send(result);
        } catch (error: any) {
          return reply.status(500).send({
            error: 'INTERNAL_ERROR',
            code: '50000',
            message: error.message || 'Failed to validate YAML',
          });
        }
      }
    );
  });
}
