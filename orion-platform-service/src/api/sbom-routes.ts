/**
 * SBOM (Software Bill of Materials) API Routes
 *
 * Routes under /api/v1/sbom
 * Handles SBOM documents, vulnerabilities, waivers, and SBOM generation.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';
import { DatabasePool } from '../services/database';
import { SbomDocumentService } from '../services/sbom/SbomDocumentService';
import { SbomVulnerabilityService } from '../services/sbom/SbomVulnerabilityService';
import { SbomWaiverService } from '../services/sbom/SbomWaiverService';
import { SBOMGeneratorService } from '../services/sbom/SBOMGeneratorService';
import pino from 'pino';

const logger = pino({ name: 'sbom-routes' });

interface SbomRoutesOptions {
  database?: DatabasePool;
}

export default async function sbomRoutes(
  app: FastifyInstance,
  options: SbomRoutesOptions
): Promise<void> {
  const docService = new SbomDocumentService(options.database);
  const vulnService = new SbomVulnerabilityService(options.database);
  const waiverService = new SbomWaiverService(options.database);
  const generatorService = options.database ? new SBOMGeneratorService(options.database) : null;

  // ==================== SBOM Documents ====================

  // GET /api/v1/sbom/documents - List SBOM documents
  app.get('/documents', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const result = await docService.list(query);
      return reply.status(200).send({ success: true, data: result });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list SBOM documents');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // GET /api/v1/sbom/documents/:id - Get SBOM document by ID
  app.get('/documents/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const doc = await docService.getById(id);
      if (!doc) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `SBOM document not found: ${id}` });
      }
      return reply.status(200).send({ success: true, data: doc });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get SBOM document');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // POST /api/v1/sbom/documents - Create SBOM document
  app.post('/documents', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sbom', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const doc = await docService.create(body);
      return reply.status(201).send({ success: true, data: doc });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create SBOM document');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // PUT /api/v1/sbom/documents/:id - Update SBOM document
  app.put('/documents/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sbom', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const body = request.body as any;
      const updated = await docService.update(id, body);
      if (!updated) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `SBOM document not found: ${id}` });
      }
      return reply.status(200).send({ success: true, data: updated });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to update SBOM document');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // DELETE /api/v1/sbom/documents/:id - Delete SBOM document
  app.delete('/documents/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sbom', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const deleted = await docService.delete(id);
      if (!deleted) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `SBOM document not found: ${id}` });
      }
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to delete SBOM document');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // ==================== Vulnerabilities ====================

  // GET /api/v1/sbom/vulnerabilities - List vulnerabilities
  app.get('/vulnerabilities', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const sbomId = query.sbomId;
      if (sbomId) {
        const result = await vulnService.scan({ sbomId });
        return reply.status(200).send({ success: true, data: result });
      }
      return reply.status(200).send({ success: true, data: { vulnerabilities: [], total: 0 } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list vulnerabilities');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // GET /api/v1/sbom/vulnerabilities/:id - Get vulnerability by ID
  app.get('/vulnerabilities/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      // SbomVulnerabilityService.getById(id) would be called here
      return reply.status(200).send({ success: true, data: { id } });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get vulnerability');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // ==================== Waivers ====================

  // GET /api/v1/sbom/waivers - List waivers
  app.get('/waivers', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const waivers = await waiverService.list(query);
      return reply.status(200).send({ success: true, data: { waivers, total: waivers.length } });
    } catch (error: any) {
      logger.error({ error }, 'Failed to list waivers');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // GET /api/v1/sbom/waivers/:id - Get waiver by ID
  app.get('/waivers/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const waiver = await waiverService.getById(id);
      if (!waiver) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `Waiver not found: ${id}` });
      }
      return reply.status(200).send({ success: true, data: waiver });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to get waiver');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // POST /api/v1/sbom/waivers - Create waiver
  app.post('/waivers', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sbom', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const waiver = await waiverService.create(body);
      return reply.status(201).send({ success: true, data: waiver });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create waiver');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // PUT /api/v1/sbom/waivers/:id - Update waiver
  app.put('/waivers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sbom', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const body = request.body as any;
      const updated = await waiverService.update(id, body);
      if (!updated) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `Waiver not found: ${id}` });
      }
      return reply.status(200).send({ success: true, data: updated });
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to update waiver');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // DELETE /api/v1/sbom/waivers/:id - Delete waiver
  app.delete('/waivers/:id', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sbom', action: 'delete' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const deleted = await waiverService.delete(id);
      if (!deleted) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: `Waiver not found: ${id}` });
      }
      return reply.status(204).send();
    } catch (error: any) {
      logger.error({ error, id: (request.params as any).id }, 'Failed to delete waiver');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  // ==================== Generate ====================

  // POST /api/v1/sbom/generate - Generate SBOM for an artifact
  app.post('/generate', {
    onRequest: [authenticateUser, requirePermission({ resource: 'sbom', action: 'write' })],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!generatorService) {
        return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'SBOM generator requires database connection' });
      }
      const sbom = await generatorService.generateSBOM({
        tenant_id: body.tenantId || body.tenant_id,
        artifact_id: body.artifactId || body.artifact_id,
        format: body.format,
      });
      return reply.status(201).send({ success: true, data: sbom });
    } catch (error: any) {
      logger.error({ error }, 'Failed to generate SBOM');
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });
}
