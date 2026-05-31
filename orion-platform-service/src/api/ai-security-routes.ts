/**
 * AI Security API Routes
 *
 * Routes under /api/v1/ai/security
 *
 * Provides security scan, policy management, and security alert endpoints
 * via the AISecurityService (four-layer protection: input sanitization,
 * execution sandbox, output validation, audit logging).
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { AISecurityService, AISecurityConfig } from '../services/ai-security';
import { DatabasePool } from '../services/database';
import pino from 'pino';

const logger = pino({ name: 'ai-security-routes' });

export interface AISecurityRoutesOptions {
  database?: DatabasePool;
  securityService?: AISecurityService;
}

export default async function aiSecurityRoutes(
  app: FastifyInstance,
  options: AISecurityRoutesOptions
): Promise<void> {
  const service = options.securityService || new AISecurityService();

  // ==================== Scans ====================

  /**
   * GET /api/v1/ai/security/scans
   * List security scan audit logs
   */
  app.get(
    '/scans',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as {
          action?: string;
          userId?: string;
          startTime?: string;
          endTime?: string;
        };

        const logs = await service.getAuditLogsAsync({
          action: query.action as any,
          userId: query.userId,
          startTime: query.startTime ? new Date(query.startTime) : undefined,
          endTime: query.endTime ? new Date(query.endTime) : undefined,
        });

        return reply.send({
          data: logs,
          meta: { total: logs.length },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to list security scans');
        return reply.status(500).send({
          error: 'SCANS_LIST_FAILED',
          message: error.message || 'Failed to list security scans',
        });
      }
    }
  );

  /**
   * GET /api/v1/ai/security/scans/:id
   * Get a specific security scan/audit log by session ID
   */
  app.get(
    '/scans/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const logs = await service.getAuditLogsAsync({ sessionId: id });

        if (logs.length === 0) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Security scan session ${id} not found`,
          });
        }

        return reply.send({ data: logs });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get security scan');
        return reply.status(500).send({
          error: 'SCAN_DETAIL_FAILED',
          message: error.message || 'Failed to get security scan detail',
        });
      }
    }
  );

  /**
   * POST /api/v1/ai/security/scans
   * Run a security scan on input text
   */
  app.post(
    '/scans',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'execute' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { input: string };

        if (!body.input) {
          return reply.status(400).send({
            error: 'BAD_REQUEST',
            message: 'input is required',
          });
        }

        const userId = (request as any).user?.id || 'unknown';
        const result = await service.processRequest(body.input, userId);

        return reply.status(201).send({ data: result });
      } catch (error: any) {
        if (error.name === 'SecurityError') {
          return reply.status(403).send({
            error: 'SECURITY_VIOLATION',
            message: error.message,
          });
        }
        logger.error({ error }, 'Security scan failed');
        return reply.status(500).send({
          error: 'SCAN_FAILED',
          message: error.message || 'Failed to run security scan',
        });
      }
    }
  );

  // ==================== Policies ====================

  /**
   * GET /api/v1/ai/security/policies
   * List current AI security policies (configuration)
   */
  app.get(
    '/policies',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'read' }),
      ],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Return the current security configuration as "policies"
        const config = (service as any).config as AISecurityConfig;

        const policies = [
          {
            id: 'input-sanitization',
            name: 'Input Sanitization',
            enabled: config.enableInputSanitization,
            description: 'Sanitize AI input to remove potential malicious content',
            settings: {
              maxInputLength: config.maxInputLength,
              blockedPatternCount: config.blockedPatterns.length,
            },
          },
          {
            id: 'execution-sandbox',
            name: 'Execution Sandbox',
            enabled: config.enableSandbox,
            description: 'Execute AI-generated code in an isolated sandbox environment',
          },
          {
            id: 'output-validation',
            name: 'Output Validation',
            enabled: config.enableOutputValidation,
            description: 'Validate AI output for sensitive information and code injection',
            settings: {
              maxOutputLength: config.maxOutputLength,
            },
          },
          {
            id: 'audit-logging',
            name: 'Audit Logging',
            enabled: config.enableAuditLog,
            description: 'Log all security events for compliance and analysis',
          },
        ];

        return reply.send({ data: policies });
      } catch (error: any) {
        logger.error({ error }, 'Failed to list security policies');
        return reply.status(500).send({
          error: 'POLICIES_LIST_FAILED',
          message: error.message || 'Failed to list security policies',
        });
      }
    }
  );

  /**
   * GET /api/v1/ai/security/policies/:id
   * Get a specific security policy
   */
  app.get(
    '/policies/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const config = (service as any).config as AISecurityConfig;

        const policyMap: Record<string, { name: string; enabled: boolean; description: string; settings?: Record<string, unknown> }> = {
          'input-sanitization': {
            name: 'Input Sanitization',
            enabled: config.enableInputSanitization,
            description: 'Sanitize AI input to remove potential malicious content',
            settings: {
              maxInputLength: config.maxInputLength,
              blockedPatternCount: config.blockedPatterns.length,
            },
          },
          'execution-sandbox': {
            name: 'Execution Sandbox',
            enabled: config.enableSandbox,
            description: 'Execute AI-generated code in an isolated sandbox environment',
          },
          'output-validation': {
            name: 'Output Validation',
            enabled: config.enableOutputValidation,
            description: 'Validate AI output for sensitive information and code injection',
            settings: { maxOutputLength: config.maxOutputLength },
          },
          'audit-logging': {
            name: 'Audit Logging',
            enabled: config.enableAuditLog,
            description: 'Log all security events for compliance and analysis',
          },
        };

        const policy = policyMap[id];
        if (!policy) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Security policy ${id} not found`,
          });
        }

        return reply.send({ data: { id, ...policy } });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get security policy');
        return reply.status(500).send({
          error: 'POLICY_DETAIL_FAILED',
          message: error.message || 'Failed to get security policy',
        });
      }
    }
  );

  /**
   * PUT /api/v1/ai/security/policies/:id
   * Update a security policy (enable/disable)
   */
  app.put(
    '/policies/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as { enabled?: boolean };

        const validPolicies = ['input-sanitization', 'execution-sandbox', 'output-validation', 'audit-logging'];
        if (!validPolicies.includes(id)) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Security policy ${id} not found`,
          });
        }

        // Map policy ID to config key
        const configKeyMap: Record<string, keyof AISecurityConfig> = {
          'input-sanitization': 'enableInputSanitization',
          'execution-sandbox': 'enableSandbox',
          'output-validation': 'enableOutputValidation',
          'audit-logging': 'enableAuditLog',
        };

        if (body.enabled !== undefined) {
          const configKey = configKeyMap[id];
          const currentConfig = (service as any).config as AISecurityConfig;
          (currentConfig as any)[configKey] = body.enabled;

          logger.info({ policyId: id, enabled: body.enabled }, 'Security policy updated');
        }

        return reply.send({
          data: { id, updated: true },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to update security policy');
        return reply.status(500).send({
          error: 'POLICY_UPDATE_FAILED',
          message: error.message || 'Failed to update security policy',
        });
      }
    }
  );

  /**
   * DELETE /api/v1/ai/security/policies/:id
   * Disable a security policy (soft delete - sets enabled to false)
   */
  app.delete(
    '/policies/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'write' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const validPolicies = ['input-sanitization', 'execution-sandbox', 'output-validation', 'audit-logging'];
        if (!validPolicies.includes(id)) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Security policy ${id} not found`,
          });
        }

        const configKeyMap: Record<string, keyof AISecurityConfig> = {
          'input-sanitization': 'enableInputSanitization',
          'execution-sandbox': 'enableSandbox',
          'output-validation': 'enableOutputValidation',
          'audit-logging': 'enableAuditLog',
        };

        const configKey = configKeyMap[id];
        const currentConfig = (service as any).config as AISecurityConfig;
        (currentConfig as any)[configKey] = false;

        logger.info({ policyId: id }, 'Security policy disabled');

        return reply.send({
          data: { id, disabled: true },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to disable security policy');
        return reply.status(500).send({
          error: 'POLICY_DELETE_FAILED',
          message: error.message || 'Failed to disable security policy',
        });
      }
    }
  );

  // ==================== Alerts ====================

  /**
   * GET /api/v1/ai/security/alerts
   * List security alerts (security violation audit logs)
   */
  app.get(
    '/alerts',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as {
          userId?: string;
          startTime?: string;
          endTime?: string;
        };

        // Get only security violation events as "alerts"
        const logs = await service.getAuditLogsAsync({
          action: 'security_violation',
          userId: query.userId,
          startTime: query.startTime ? new Date(query.startTime) : undefined,
          endTime: query.endTime ? new Date(query.endTime) : undefined,
        });

        const alerts = logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          userId: log.userId,
          sessionId: log.sessionId,
          riskScore: log.details.riskScore,
          violations: log.details.violations,
        }));

        return reply.send({
          data: alerts,
          meta: { total: alerts.length },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to list security alerts');
        return reply.status(500).send({
          error: 'ALERTS_LIST_FAILED',
          message: error.message || 'Failed to list security alerts',
        });
      }
    }
  );

  /**
   * GET /api/v1/ai/security/alerts/:id
   * Get a specific security alert by ID
   */
  app.get(
    '/alerts/:id',
    {
      onRequest: [
        authenticateUser,
        requirePermission({ resource: 'ai-security', action: 'read' }),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };

        const logs = await service.getAuditLogsAsync({
          action: 'security_violation',
        });

        const alert = logs.find((log) => log.id === id);
        if (!alert) {
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Security alert ${id} not found`,
          });
        }

        return reply.send({
          data: {
            id: alert.id,
            timestamp: alert.timestamp,
            userId: alert.userId,
            sessionId: alert.sessionId,
            riskScore: alert.details.riskScore,
            violations: alert.details.violations,
          },
        });
      } catch (error: any) {
        logger.error({ error }, 'Failed to get security alert');
        return reply.status(500).send({
          error: 'ALERT_DETAIL_FAILED',
          message: error.message || 'Failed to get security alert detail',
        });
      }
    }
  );
}
