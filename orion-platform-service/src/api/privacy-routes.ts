// orion-platform-service/src/api/privacy-routes.ts
/**
 * Privacy Policy API Routes
 *
 * Provides tenant privacy policy configuration and content sanitization.
 * All endpoints require authentication and tenant isolation.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TenantPrivacyPolicyService, TenantPrivacyPolicy } from '../services/privacy/TenantPrivacyPolicyService';
import { SecretSanitizer } from '../services/privacy/SecretSanitizer';
import { PIISanitizer } from '../services/privacy/PIISanitizer';
import { authenticateUser } from '../middleware/authMiddleware';

interface TenantParams {
  tenantId: string;
}

interface PolicyBody {
  policyLevel?: 'standard' | 'enhanced' | 'strict' | 'custom';
  secretSanitizationEnabled?: boolean;
  piiSanitizationEnabled?: boolean;
  nerModelType?: 'bert-local' | 'bert-remote' | 'regex-only';
  localModelRequired?: boolean;
  sensitiveDataTypes?: string[];
  piiTypes?: string[];
  customPatterns?: Array<{ type: string; pattern: string }>;
}

interface SanitizeBody {
  content: string;
  options?: {
    maxLength?: number;
    preserveFormat?: boolean;
  };
}

// Maximum content size: 1MB
const MAX_CONTENT_SIZE = 1024 * 1024;

// Service singletons
let policyService: TenantPrivacyPolicyService | null = null;
let secretSanitizer: SecretSanitizer | null = null;
let piiSanitizer: PIISanitizer | null = null;

export default async function privacyRoutes(fastify: FastifyInstance) {
  // Initialize service singletons
  if (!policyService) {
    policyService = new TenantPrivacyPolicyService();
  }
  if (!secretSanitizer) {
    secretSanitizer = new SecretSanitizer();
  }
  if (!piiSanitizer) {
    piiSanitizer = new PIISanitizer();
  }

  // Apply authentication to all routes
  fastify.addHook('onRequest', authenticateUser);

  /**
   * Helper: Verify user has access to the specified tenant
   */
  function verifyTenantAccess(request: FastifyRequest, tenantId: number): boolean {
    const userTenantId = request.user?.tenantId;
    const userRole = request.user?.role;

    // Admin can access any tenant
    if (userRole === 'admin') {
      return true;
    }

    // Regular users can only access their own tenant
    return userTenantId === tenantId;
  }

  // Get tenant privacy policy
  fastify.get<{ Params: TenantParams }>(
    '/:tenantId/policy',
    async (request: FastifyRequest<{ Params: TenantParams }>, reply: FastifyReply) => {
      try {
        const tenantId = parseInt(request.params.tenantId, 10);

        if (isNaN(tenantId)) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'Invalid tenant ID',
          });
          return;
        }

        // Tenant isolation check
        if (!verifyTenantAccess(request, tenantId)) {
          reply.code(403).send({
            code: 403,
            error: 'FORBIDDEN',
            message: 'Access denied to this tenant',
          });
          return;
        }

        const policy = policyService!.getPolicy(tenantId);

        if (!policy) {
          reply.code(404).send({
            code: 404,
            error: 'NOT_FOUND',
            message: 'Policy not found for this tenant',
          });
          return;
        }

        reply.send(policy);
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to get privacy policy',
        });
      }
    }
  );

  // Create or update tenant privacy policy (admin only)
  fastify.put<{ Params: TenantParams; Body: PolicyBody }>(
    '/:tenantId/policy',
    async (request: FastifyRequest<{ Params: TenantParams; Body: PolicyBody }>, reply: FastifyReply) => {
      try {
        const tenantId = parseInt(request.params.tenantId, 10);

        if (isNaN(tenantId)) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'Invalid tenant ID',
          });
          return;
        }

        // Authorization: admin can modify any tenant's policy
        if (request.user?.role !== 'admin') {
          reply.code(403).send({
            code: 403,
            error: 'FORBIDDEN',
            message: 'Only admin can modify privacy policies',
          });
          return;
        }

        const policyData = request.body;
        const policy = policyService!.setPolicy(tenantId, policyData);
        reply.send(policy);
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to update privacy policy',
        });
      }
    }
  );

  // Validate compliance for tenant
  fastify.get<{ Params: TenantParams }>(
    '/:tenantId/compliance',
    async (request: FastifyRequest<{ Params: TenantParams }>, reply: FastifyReply) => {
      try {
        const tenantId = parseInt(request.params.tenantId, 10);

        if (isNaN(tenantId)) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'Invalid tenant ID',
          });
          return;
        }

        if (!verifyTenantAccess(request, tenantId)) {
          reply.code(403).send({
            code: 403,
            error: 'FORBIDDEN',
            message: 'Access denied to this tenant',
          });
          return;
        }

        const result = await policyService!.validatePolicyCompliance(tenantId, 'regex-only');
        reply.send(result);
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to validate compliance',
        });
      }
    }
  );

  // Sanitize content (secrets + PII)
  fastify.post<{ Body: SanitizeBody }>(
    '/sanitize',
    async (request: FastifyRequest<{ Body: SanitizeBody }>, reply: FastifyReply) => {
      try {
        const { content, options } = request.body;

        // Input validation
        if (!content || typeof content !== 'string') {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'content is required and must be a string',
          });
          return;
        }

        // Size limit check
        const maxLength = options?.maxLength || MAX_CONTENT_SIZE;
        if (content.length > maxLength) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: `Content exceeds maximum size limit (${maxLength} bytes)`,
          });
          return;
        }

        // Sanitize secrets
        const secretResult = secretSanitizer!.sanitize(content);

        // Sanitize PII (async)
        const piiResult = await piiSanitizer!.sanitize(secretResult.sanitized);

        reply.send({
          sanitized: piiResult.sanitized,
          secretsDetected: secretResult.detectedCount,
          piiDetected: piiResult.detectedCount,
        });
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to sanitize content',
        });
      }
    }
  );

  // Detect secrets in content
  fastify.post<{ Body: { content: string } }>(
    '/detect-secrets',
    async (request: FastifyRequest<{ Body: { content: string } }>, reply: FastifyReply) => {
      try {
        const { content } = request.body;

        if (!content || typeof content !== 'string') {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'content is required',
          });
          return;
        }

        if (content.length > MAX_CONTENT_SIZE) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: `Content exceeds maximum size limit (${MAX_CONTENT_SIZE} bytes)`,
          });
          return;
        }

        const detected = secretSanitizer!.detectSecrets(content);
        reply.send({ detected, count: detected.length });
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to detect secrets',
        });
      }
    }
  );

  // Detect PII in content (with NER)
  fastify.post<{ Body: { content: string } }>(
    '/detect-pii',
    async (request: FastifyRequest<{ Body: { content: string } }>, reply: FastifyReply) => {
      try {
        const { content } = request.body;

        if (!content || typeof content !== 'string') {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: 'content is required',
          });
          return;
        }

        if (content.length > MAX_CONTENT_SIZE) {
          reply.code(400).send({
            code: 400,
            error: 'BAD_REQUEST',
            message: `Content exceeds maximum size limit (${MAX_CONTENT_SIZE} bytes)`,
          });
          return;
        }

        const detected = await piiSanitizer!.detectPIIWithNER(content);
        reply.send({ detected, count: detected.length });
      } catch (error) {
        reply.code(500).send({
          code: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to detect PII',
        });
      }
    }
  );
}