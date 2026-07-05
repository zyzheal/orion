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
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { OrionError, ValidationError, NotFoundError, ForbiddenError, ErrorCode, handleError } from '../errors';

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

interface PrivacyRoutesOptions {
  database?: DatabasePool;
}

export default async function privacyRoutes(
  fastify: FastifyInstance,
  options: PrivacyRoutesOptions = {}
): Promise<void> {
  void options.database;
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
    const userRole = (request.user as any)?.role;

    // Admin can access any tenant
    if (userRole === 'admin') {
      return true;
    }

    // Regular users can only access their own tenant
    return (userTenantId as any) === tenantId;
  }

  // Get tenant privacy policy
  fastify.get<{ Params: TenantParams }>(
    '/:tenantId/policy',
    {
      onRequest: [requirePermission({ resource: 'privacy', action: 'read' })],
    },
    async (request: FastifyRequest<{ Params: TenantParams }>, reply: FastifyReply) => {
      try {
        const tenantId = parseInt((request.params as any).tenantId, 10);

        if (isNaN(tenantId)) {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        // Tenant isolation check
        if (!verifyTenantAccess(request, tenantId)) {
handleError(reply, new ForbiddenError('FORBIDDEN'))
          return;
        }

        const policy = policyService!.getPolicy(tenantId);

        if (!policy) {
handleError(reply, new NotFoundError('NOT_FOUND'))
          return;
        }

        reply.send(policy);
      } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // Create or update tenant privacy policy (admin only)
  fastify.put<{ Params: TenantParams; Body: PolicyBody }>(
    '/:tenantId/policy',
    {
      onRequest: [requirePermission({ resource: 'privacy', action: 'write' })],
    },
    async (request: FastifyRequest<{ Params: TenantParams; Body: PolicyBody }>, reply: FastifyReply) => {
      try {
        const tenantId = parseInt((request.params as any).tenantId, 10);

        if (isNaN(tenantId)) {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        // Authorization: admin can modify any tenant's policy
        if ((request.user as any)?.role !== 'admin') {
handleError(reply, new ForbiddenError('FORBIDDEN'))
          return;
        }

        const policyData = request.body;
        const policy = policyService!.setPolicy(tenantId, policyData);
        reply.send(policy);
      } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // Validate compliance for tenant
  fastify.get<{ Params: TenantParams }>(
    '/:tenantId/compliance',
    {
      onRequest: [requirePermission({ resource: 'privacy', action: 'read' })],
    },
    async (request: FastifyRequest<{ Params: TenantParams }>, reply: FastifyReply) => {
      try {
        const tenantId = parseInt((request.params as any).tenantId, 10);

        if (isNaN(tenantId)) {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        if (!verifyTenantAccess(request, tenantId)) {
handleError(reply, new ForbiddenError('FORBIDDEN'))
          return;
        }

        const result = await policyService!.validatePolicyCompliance(tenantId, 'regex-only');
        reply.send(result);
      } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // Sanitize content (secrets + PII)
  fastify.post<{ Body: SanitizeBody }>(
    '/sanitize',
    {
      onRequest: [requirePermission({ resource: 'privacy', action: 'write' })],
    },
    async (request: FastifyRequest<{ Body: SanitizeBody }>, reply: FastifyReply) => {
      try {
        const {  content, options  } = request.body as any;

        // Input validation
        if (!content || typeof content !== 'string') {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        // Size limit check
        const maxLength = options?.maxLength || MAX_CONTENT_SIZE;
        if (content.length > maxLength) {
handleError(reply, new ValidationError('BAD_REQUEST'))
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
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // Detect secrets in content
  fastify.post<{ Body: { content: string } }>(
    '/detect-secrets',
    {
      onRequest: [requirePermission({ resource: 'privacy', action: 'write' })],
    },
    async (request: FastifyRequest<{ Body: { content: string } }>, reply: FastifyReply) => {
      try {
        const {  content  } = request.body as any;

        if (!content || typeof content !== 'string') {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        if (content.length > MAX_CONTENT_SIZE) {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        const detected = secretSanitizer!.detectSecrets(content);
        reply.send({ detected, count: detected.length });
      } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
      }
    }
  );

  // Detect PII in content (with NER)
  fastify.post<{ Body: { content: string } }>(
    '/detect-pii',
    {
      onRequest: [requirePermission({ resource: 'privacy', action: 'write' })],
    },
    async (request: FastifyRequest<{ Body: { content: string } }>, reply: FastifyReply) => {
      try {
        const {  content  } = request.body as any;

        if (!content || typeof content !== 'string') {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        if (content.length > MAX_CONTENT_SIZE) {
handleError(reply, new ValidationError('BAD_REQUEST'))
          return;
        }

        const detected = await piiSanitizer!.detectPIIWithNER(content);
        reply.send({ detected, count: detected.length });
      } catch (error) {
handleError(reply, new OrionError('INTERNAL_ERROR', ErrorCode.INTERNAL_ERROR))
      }
    }
  );
}