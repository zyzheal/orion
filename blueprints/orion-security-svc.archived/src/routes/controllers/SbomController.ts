/**
 * SbomController - SBOM Attestation API Controller
 *
 * Handles SBOM document CRUD, attestation signing/verification,
 * vulnerability scanning, waivers, and compliance reports.
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SbomDocumentService } from '../../services/SbomDocumentService';
import { SbomVulnerabilityService } from '../../services/SbomVulnerabilityService';
import { SbomWaiverService } from '../../services/SbomWaiverService';

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

  async listDocuments(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { buildId?: string; pipelineRunId?: string; format?: string; status?: string; page?: string; perPage?: string };
      const result = await this.documentService.list({
        buildId: query.buildId,
        pipelineRunId: query.pipelineRunId,
        format: query.format as any,
        status: query.status as any,
        page: query.page ? parseInt(query.page, 10) : undefined,
        perPage: query.perPage ? parseInt(query.perPage, 10) : undefined,
      });
      reply.send({ code: 200, message: 'OK', data: result.documents, total: result.total });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async createDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { buildId: string; pipelineRunId: string; format?: string; specVersion?: string; content?: Record<string, unknown> };
      if (!body.buildId || !body.pipelineRunId) {
        reply.status(400).send({ code: 400, message: 'buildId and pipelineRunId are required' });
        return;
      }
      const doc = await this.documentService.create(body as any);
      reply.status(201).send({ code: 201, message: 'Created', data: doc });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const doc = await this.documentService.getById(id);
      if (!doc) {
        reply.status(404).send({ code: 404, message: 'Document not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: doc });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async updateDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { status?: string; expiresAt?: string };
      const doc = await this.documentService.update(id, {
        status: body.status as any,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });
      if (!doc) {
        reply.status(404).send({ code: 404, message: 'Document not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: doc });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async deleteDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const deleted = await this.documentService.delete(id);
      if (!deleted) {
        reply.status(404).send({ code: 404, message: 'Document not found' });
        return;
      }
      reply.send({ code: 200, message: 'Document deleted' });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getPackages(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const packages = await this.documentService.getPackages(id);
      reply.send({ code: 200, message: 'OK', data: packages });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async downloadDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const doc = await this.documentService.getById(id);
      if (!doc) {
        reply.status(404).send({ code: 404, message: 'Document not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: doc.content });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async signAttestation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { sbomId: string; attestationType: string; signature: string; certificate?: string; transparencyLogUrl?: string };
      const attestation = await this.documentService.createAttestation({
        sbomId: body.sbomId,
        attestationType: body.attestationType as 'sigstore-cosign' | 'in-toto',
        signature: body.signature,
        certificate: body.certificate,
        transparencyLogUrl: body.transparencyLogUrl,
      });
      reply.status(201).send({ code: 201, message: 'Created', data: attestation });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getAttestation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const attestation = await this.documentService.getAttestationBySbomId(id);
      if (!attestation) {
        reply.status(404).send({ code: 404, message: 'Attestation not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: attestation });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async verifyAttestation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const attestation = await this.documentService.verifyAttestation(id);
      if (!attestation) {
        reply.status(404).send({ code: 404, message: 'Attestation not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: attestation });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async scanVulnerability(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { sbomId: string; gatePolicy?: string };
      if (!body.sbomId) {
        reply.status(400).send({ code: 400, message: 'sbomId is required' });
        return;
      }
      const result = await this.vulnerabilityService.scan(body);
      reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getVulnerabilityResults(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { sbomId?: string };
      if (!query.sbomId) {
        reply.status(400).send({ code: 400, message: 'sbomId query parameter is required' });
        return;
      }
      const results = await this.vulnerabilityService.getBySbomId(query.sbomId);
      reply.send({ code: 200, message: 'OK', data: results });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getVulnerabilityDetails(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const result = await this.vulnerabilityService.getById(id);
      if (!result) {
        reply.status(404).send({ code: 404, message: 'Vulnerability not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async gateCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as { sbomId: string; policy: string };
      if (!body.sbomId || !body.policy) {
        reply.status(400).send({ code: 400, message: 'sbomId and policy are required' });
        return;
      }
      const result = await this.vulnerabilityService.gateCheck(body.sbomId, body.policy);
      reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async listWaivers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { scope?: string; scopeTarget?: string; active?: string; cveId?: string };
      const waivers = await this.waiverService.list({
        scope: query.scope as any,
        scopeTarget: query.scopeTarget,
        active: query.active === 'true',
        cveId: query.cveId,
      });
      reply.send({ code: 200, message: 'OK', data: waivers });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async createWaiver(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as {
        cveId: string; packageName: string; packageVersion: string;
        reason: string; scope: string; scopeTarget?: string;
        approvedBy?: string; expiresAt?: string;
      };
      if (!body.cveId || !body.packageName || !body.reason || !body.scope) {
        reply.status(400).send({ code: 400, message: 'cveId, packageName, reason, and scope are required' });
        return;
      }
      const waiver = await this.waiverService.create({
        cveId: body.cveId,
        packageName: body.packageName,
        packageVersion: body.packageVersion,
        reason: body.reason,
        scope: body.scope as any,
        scopeTarget: body.scopeTarget,
        approvedBy: body.approvedBy,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });
      reply.status(201).send({ code: 201, message: 'Created', data: waiver });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async getActiveWaivers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as { scope?: string; target?: string };
      const waivers = await this.waiverService.getActiveWaivers(query.scope as any, query.target);
      reply.send({ code: 200, message: 'OK', data: waivers });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async updateWaiver(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { reason?: string; approvedBy?: string; expiresAt?: string };
      const waiver = await this.waiverService.update(id, {
        reason: body.reason,
        approvedBy: body.approvedBy,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });
      if (!waiver) {
        reply.status(404).send({ code: 404, message: 'Waiver not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: waiver });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }

  async deleteWaiver(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const deleted = await this.waiverService.delete(id);
      if (!deleted) {
        reply.status(404).send({ code: 404, message: 'Waiver not found' });
        return;
      }
      reply.send({ code: 200, message: 'Waiver deleted' });
    } catch (error: any) {
      reply.status(500).send({ code: 500, message: error.message });
    }
  }
}
