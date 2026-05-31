/**
 * AI Gateway API Routes
 *
 * Routes under /api/v1/ai/gateway
 *
 * Provides AI generation, diagnosis, model listing, and health check endpoints
 * via the AIGateway, AIGenerateService, and AIDiagnosisService.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { AIGateway } from '../services/ai/AIGateway';
import { AIGenerateService, GenerateRequest } from '../services/ai/AIGenerateService';
import { AIDiagnosisService, DiagnosisContext } from '../services/ai/AIDiagnosisService';
import pino from 'pino';

const logger = pino({ name: 'ai-gateway-routes' });

export interface AIGatewayRoutesOptions {
  aiGateway?: AIGateway;
  generateService?: AIGenerateService;
  diagnosisService?: AIDiagnosisService;
}

export default async function aiGatewayRoutes(
  app: FastifyInstance,
  options: AIGatewayRoutesOptions
): Promise<void> {
  const gateway = options.aiGateway || new AIGateway();
  const generateService = options.generateService || new AIGenerateService();
  const diagnosisService = options.diagnosisService || new AIDiagnosisService();

  // ==================== AI Generate ====================

  /**
   * POST /api/v1/ai/gateway/generate
   * Generate AI content (scripts, code, etc.)
   */
  app.post(
    '/generate',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-gateway', action: 'execute' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as GenerateRequest;

        if (!body.prompt) {
          return reply.status(400).send({
            error: 'BAD_REQUEST',
            message: 'prompt is required',
          });
        }

        const result = await generateService.generateScript({
          prompt: body.prompt,
          language: body.language || 'bash',
          level: body.level,
        });

        return reply.status(201).send({ data: result });
      } catch (error: any) {
        logger.error({ error }, 'AI generate failed');
        return reply.status(500).send({
          error: 'GENERATE_FAILED',
          message: error.message || 'Failed to generate AI content',
        });
      }
    }
  );

  // ==================== AI Diagnose ====================

  /**
   * POST /api/v1/ai/gateway/diagnose
   * Diagnose errors and suggest fixes
   */
  app.post(
    '/diagnose',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-gateway', action: 'execute' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as DiagnosisContext;

        if (!body.errorMessage) {
          return reply.status(400).send({
            error: 'BAD_REQUEST',
            message: 'errorMessage is required',
          });
        }

        const result = await diagnosisService.diagnose({
          taskId: body.taskId || 'unknown',
          pluginId: body.pluginId || 'unknown',
          errorMessage: body.errorMessage,
          errorStack: body.errorStack || '',
          isolationTier: body.isolationTier,
          durationMs: body.durationMs || 0,
          recentLogs: body.recentLogs,
        });

        return reply.send({ data: result });
      } catch (error: any) {
        logger.error({ error }, 'AI diagnosis failed');
        return reply.status(500).send({
          error: 'DIAGNOSIS_FAILED',
          message: error.message || 'Failed to run AI diagnosis',
        });
      }
    }
  );

  // ==================== Models ====================

  /**
   * GET /api/v1/ai/gateway/models
   * List available AI models/providers
   */
  app.get(
    '/models',
    {
      onRequest: [authenticateUser],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const providers = gateway.getAvailableProviders();
        const currentProvider = gateway.getCurrentProvider();
        const healthSummary = gateway.getDualCircuitHealthSummary();

        return reply.send({
          data: {
            providers,
            currentProvider,
            healthSummary,
          },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to list AI models');
        return reply.status(500).send({
          error: 'MODELS_LIST_FAILED',
          message: error.message || 'Failed to list available models',
        });
      }
    }
  );

  // ==================== Health ====================

  /**
   * GET /api/v1/ai/gateway/health
   * Get AI gateway health status
   */
  app.get(
    '/health',
    {
      onRequest: [authenticateUser],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const allHealth = await gateway.getAllHealth();
        const circuitBreakerManager = gateway.getCircuitBreakerManager();
        const healthSummary = circuitBreakerManager.getHealthSummary();

        return reply.send({
          data: {
            scenarios: allHealth,
            summary: healthSummary,
          },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get AI gateway health');
        return reply.status(500).send({
          error: 'HEALTH_CHECK_FAILED',
          message: error.message || 'Failed to check AI gateway health',
        });
      }
    }
  );
}
