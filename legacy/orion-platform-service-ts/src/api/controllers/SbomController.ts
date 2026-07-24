/**
 * SBOM Controller - Fastify HTTP request/response handlers
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SbomDocumentService } from '../../services/sbom/SbomDocumentService';
import { SbomVulnerabilityService } from '../../services/sbom/SbomVulnerabilityService';
import { SbomWaiverService } from '../../services/sbom/SbomWaiverService';

export class SbomController {
  private documentService: SbomDocumentService;
  private vulnerabilityService: SbomVulnerabilityService;
  private waiverService: SbomWaiverService;

  constructor(options: {
    documentService: SbomDocumentService;
    vulnerabilityService: SbomVulnerabilityService;
    waiverService: SbomWaiverService;
  }) {
    this.documentService = options.documentService;
    this.vulnerabilityService = options.vulnerabilityService;
    this.waiverService = options.waiverService;
  }

  // ==================== Document CRUD ====================

  async listDocuments(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const { documents, total } = await this.documentService.list({
        buildId: query.buildId,
        pipelineRunId: query.pipelineRunId,
        format: query.format,
        status: query.status,
        page: query.page ? parseInt(query.page) : undefined,
        perPage: query.perPage ? parseInt(query.perPage) : undefined,
      });

      await reply.send({ success: true, data: documents, total });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const doc = await this.documentService.getById(params.id);
      if (!doc) {
        await reply.status(404).send({ success: false, error: 'SBOM document not found' });
        return;
      }
      await reply.send({ success: true, data: doc });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.buildId || !body.pipelineRunId || !body.format || !body.content) {
        await reply.status(400).send({
          success: false,
          error: 'buildId, pipelineRunId, format, and content are required',
        });
        return;
      }
      const doc = await this.documentService.create(body);

      // Add packages if provided
      if (body.packages && Array.isArray(body.packages)) {
        for (const pkg of body.packages) {
          await this.documentService.addPackage({ sbomId: doc.id, ...pkg });
        }
      }

      await reply.status(201).send({ success: true, data: doc });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create SBOM document',
      });
    }
  }

  async updateDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const doc = await this.documentService.update(params.id, body);
      if (!doc) {
        await reply.status(404).send({ success: false, error: 'SBOM document not found' });
        return;
      }
      await reply.send({ success: true, data: doc });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update SBOM document',
      });
    }
  }

  async deleteDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const deleted = await this.documentService.delete(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'SBOM document not found' });
        return;
      }
      await reply.send({ success: true, message: 'SBOM document deleted' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getPackages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const packages = await this.documentService.getPackages(params.id);
      await reply.send({ success: true, data: packages, total: packages.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async downloadDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const doc = await this.documentService.getById(params.id);
      if (!doc) {
        await reply.status(404).send({ success: false, error: 'SBOM document not found' });
        return;
      }

      const format = query.format || doc.format;
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename=sbom-${doc.id}.${format}`);
      await reply.send({ success: true, data: doc.content });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  // ==================== Attestation ====================

  async signAttestation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;

      const attestation = await this.documentService.createAttestation({
        sbomId: params.id,
        attestationType: body.attestationType || 'sigstore-cosign',
        signature: body.signature,
        certificate: body.certificate,
        transparencyLogUrl: body.transparencyLogUrl,
      });

      await reply.status(201).send({ success: true, data: attestation });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sign attestation',
      });
    }
  }

  async getAttestation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const attestation = await this.documentService.getAttestationBySbomId(params.id);
      if (!attestation) {
        await reply.status(404).send({ success: false, error: 'Attestation not found' });
        return;
      }
      await reply.send({ success: true, data: attestation });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async verifyAttestation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const attestation = await this.documentService.getAttestationBySbomId(params.id);
      if (!attestation) {
        await reply.status(404).send({ success: false, error: 'Attestation not found' });
        return;
      }

      const verified = await this.documentService.verifyAttestation(attestation.id);
      await reply.send({ success: true, data: verified });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to verify attestation',
      });
    }
  }

  // ==================== Vulnerability ====================

  async scanVulnerability(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.sbomId) {
        await reply.status(400).send({ success: false, error: 'sbomId is required' });
        return;
      }

      const result = await this.vulnerabilityService.scan(body);
      await reply.status(201).send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Scan failed',
      });
    }
  }

  async getVulnerabilityResults(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      if (query.sbomId) {
        const results = await this.vulnerabilityService.getBySbomId(query.sbomId);
        await reply.send({ success: true, data: results, total: results.length });
        return;
      }
      await reply.send({ success: true, data: [], total: 0 });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getVulnerabilityDetails(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const result = await this.vulnerabilityService.getById(params.id);
      if (!result) {
        await reply.status(404).send({ success: false, error: 'Vulnerability result not found' });
        return;
      }
      await reply.send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async gateCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.sbomId) {
        await reply.status(400).send({ success: false, error: 'sbomId is required' });
        return;
      }

      const result = await this.vulnerabilityService.gateCheck(body.sbomId, body.policy || 'block-critical');
      await reply.send({ success: true, data: result });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Gate check failed',
      });
    }
  }

  // ==================== Waiver CRUD ====================

  async listWaivers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const waivers = await this.waiverService.list({
        scope: query.scope,
        scopeTarget: query.scopeTarget,
        active: query.active === 'true',
        cveId: query.cveId,
      });
      await reply.send({ success: true, data: waivers, total: waivers.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async getActiveWaivers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      const waivers = await this.waiverService.getActiveWaivers(query.scope, query.target);
      await reply.send({ success: true, data: waivers, total: waivers.length });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }

  async createWaiver(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body.cveId || !body.packageName || !body.packageVersion || !body.reason || !body.approvedBy || !body.expiresAt) {
        await reply.status(400).send({
          success: false,
          error: 'cveId, packageName, packageVersion, reason, approvedBy, and expiresAt are required',
        });
        return;
      }
      const waiver = await this.waiverService.create(body);
      await reply.status(201).send({ success: true, data: waiver });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create waiver',
      });
    }
  }

  async updateWaiver(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const waiver = await this.waiverService.update(params.id, body);
      if (!waiver) {
        await reply.status(404).send({ success: false, error: 'Waiver not found' });
        return;
      }
      await reply.send({ success: true, data: waiver });
    } catch (err) {
      await reply.status(400).send({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update waiver',
      });
    }
  }

  async deleteWaiver(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as any;
      const deleted = await this.waiverService.delete(params.id);
      if (!deleted) {
        await reply.status(404).send({ success: false, error: 'Waiver not found' });
        return;
      }
      await reply.send({ success: true, message: 'Waiver deleted' });
    } catch (err) {
      await reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  }
}
