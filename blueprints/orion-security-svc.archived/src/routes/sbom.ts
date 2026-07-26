/**
 * SBOM Attestation API Routes
 *
 * Routes under /api/v1/sbom
 * Migrated to PostgreSQL Repository pattern
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../utils/database';
import { SbomDocumentService } from '../services/SbomDocumentService';
import { SbomVulnerabilityService } from '../services/SbomVulnerabilityService';
import { SbomWaiverService } from '../services/SbomWaiverService';
import { SbomController } from './controllers/SbomController';
import { EventBusService } from '../services/event-bus-service';

interface SbomRoutesOptions {
  eventBus?: EventBusService;
  database?: DatabasePool;
}

export default async function sbomRoutes(
  app: FastifyInstance,
  options: SbomRoutesOptions
): Promise<void> {
  const documentService = new SbomDocumentService({
    eventBus: options.eventBus,
    db: options.database,
  });
  const vulnerabilityService = new SbomVulnerabilityService({
    eventBus: options.eventBus,
    db: options.database,
  });
  const waiverService = new SbomWaiverService({
    eventBus: options.eventBus,
    db: options.database,
  });
  const controller = new SbomController({
    documentService,
    vulnerabilityService,
    waiverService,
  });

  // ==================== SBOM Documents ====================

  app.get('/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listDocuments(request, reply);
  });

  app.post('/documents', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createDocument(request, reply);
  });

  app.get('/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getDocument(request, reply);
  });

  app.put('/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateDocument(request, reply);
  });

  app.delete('/documents/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteDocument(request, reply);
  });

  app.get('/documents/:id/packages', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getPackages(request, reply);
  });

  app.get('/documents/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.downloadDocument(request, reply);
  });

  // ==================== Attestations ====================

  app.post('/attestations/:id/sign', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.signAttestation(request, reply);
  });

  app.get('/attestations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getAttestation(request, reply);
  });

  app.post('/attestations/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.verifyAttestation(request, reply);
  });

  // ==================== Vulnerability ====================

  app.post('/vulnerability/scan', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.scanVulnerability(request, reply);
  });

  app.get('/vulnerability/results', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getVulnerabilityResults(request, reply);
  });

  app.get('/vulnerability/results/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getVulnerabilityDetails(request, reply);
  });

  app.post('/vulnerability/gate/check', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.gateCheck(request, reply);
  });

  // ==================== Waivers ====================

  app.get('/waivers', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.listWaivers(request, reply);
  });

  app.post('/waivers', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.createWaiver(request, reply);
  });

  app.get('/waivers/active', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.getActiveWaivers(request, reply);
  });

  app.get('/waivers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    if (params.id === 'active') {
      return controller.getActiveWaivers(request, reply);
    }
    const doc = await controller['documentService'].getById(params.id);
    if (doc) return controller.getDocument(request, reply);
    const waiver = await waiverService.getById(params.id);
    if (waiver) return reply.send({ success: true, data: waiver });
    return reply.status(404).send({ success: false, error: 'Not found' });
  });

  app.put('/waivers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.updateWaiver(request, reply);
  });

  app.delete('/waivers/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    return controller.deleteWaiver(request, reply);
  });

  // ==================== Compliance Reports ====================

  app.get('/compliance/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { scope?: string; startDate?: string; endDate?: string };
    try {
      const report = await documentService.getComplianceReport({
        scope: query.scope,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });
      return reply.send({ code: 200, message: 'OK', data: report });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/compliance/eo14028', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const compliance = await documentService.getEO14028Compliance();
      return reply.send({ code: 200, message: 'OK', data: compliance });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/compliance/eu-cra', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const compliance = await documentService.getEUCRACompliance();
      return reply.send({ code: 200, message: 'OK', data: compliance });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Provenance ====================

  app.post('/provenance', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      buildId: string;
      provenanceType: string;
      content: Record<string, unknown>;
      signature: string;
      builderId: string;
      buildTrigger: string;
      sourceUri: string;
    };
    try {
      const provenance = await documentService.createProvenance(body);
      return reply.status(201).send({ code: 201, message: 'Created', data: provenance });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/provenance', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { buildId?: string };
    try {
      const provenances = await documentService.listProvenance(query.buildId);
      return reply.send({ code: 200, message: 'OK', data: provenances });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/provenance/:id/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    try {
      const result = await documentService.verifyProvenance(params.id);
      return reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ code: 404, message: error.message });
      }
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  // ==================== Gate ====================

  app.post('/gate/evaluate', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { buildId: string };
    if (!query.buildId) {
      return reply.status(400).send({ code: 400, message: 'buildId query parameter is required' });
    }
    try {
      const result = await documentService.evaluateGate(query.buildId);
      return reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });

  app.get('/gate/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { buildId?: string };
    try {
      const history = await documentService.getGateHistory(query.buildId);
      return reply.send({ code: 200, message: 'OK', data: history });
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message });
    }
  });
}
