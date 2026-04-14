/**
 * Audit API Routes
 *
 * 不可逆审计链、完整性验证、immutable 存储
 *
 * Prefix: /api/v1/audit
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuditLogChain } from '../services/audit/AuditLogChain';
import { ImmutableAuditStorage, DEFAULT_STORAGE_CONFIG } from '../services/audit/ImmutableAuditStorage';
import { AuditIntegrityVerifier } from '../services/audit/AuditIntegrityVerifier';
import { ChainedAuditLogEntry, ChainVerificationResult, IntegrityReport } from '../services/audit/AuditTypes';

interface AuditLogCreate {
  action: string;
  userId: string;
  tenantId?: string;
  details: Record<string, any>;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditVerifyParams {
  fromSequence?: number;
  toSequence?: number;
}

export default async function auditRoutes(app: FastifyInstance): Promise<void> {
  // Initialize services
  const auditLogChain = new AuditLogChain();
  const storage = new ImmutableAuditStorage(DEFAULT_STORAGE_CONFIG);
  const verifier = new AuditIntegrityVerifier({
    chain: auditLogChain,
    storage,
  });

  // ==================== Audit Log CRUD ====================

  // POST /audit/logs - 创建审计日志
  app.post('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AuditLogCreate;

    try {
      const entry = auditLogChain.addEntry(
        body.action,
        body.userId,
        body.details,
        body.tenantId
      );

      return reply.status(201).send({ entry });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'AUDIT_LOG_ERROR',
        message: error.message,
      });
    }
  });

  // GET /audit/logs - 获取审计日志列表
  app.get('/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      action?: string;
      userId?: string;
      tenantId?: string;
      resourceType?: string;
      resourceId?: string;
      fromSequence?: number;
      toSequence?: number;
      limit?: number;
    };

    const entries = auditLogChain.getEntries(query);
    const limit = query.limit || 100;

    return reply.send({
      entries: entries.slice(0, limit),
      total: entries.length,
    });
  });

  // ==================== Chain Verification ====================

  // POST /audit/verify - 验证审计链完整性
  app.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AuditVerifyParams;

    try {
      let result: ChainVerificationResult;

      if (body.fromSequence !== undefined && body.toSequence !== undefined) {
        // Verify specific range
        result = auditLogChain.verifyChain({
          startSequence: body.fromSequence,
          endSequence: body.toSequence,
        });
      } else {
        // Verify entire chain
        result = auditLogChain.verifyChain();
      }

      return reply.send({
        result,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'VERIFICATION_ERROR',
        message: error.message,
      });
    }
  });

  // ==================== Storage Management ====================

  // GET /audit/storage/stats - 获取存储统计
  app.get('/storage/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = storage.getStats();
    return reply.send({ stats });
  });

  // POST /audit/storage/flush - 刷新存储
  app.post('/storage/flush', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await storage.flush();
      return reply.send({ status: 'flushed' });
    } catch (error: any) {
      return reply.status(500).send({
        error: 'FLUSH_ERROR',
        message: error.message,
      });
    }
  });
}
