/**
 * ArtifactOpsController - Artifact Operations, Scan, and Retention API Controller
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactOperationService } from '../../services/ArtifactOperationService';
import { ArtifactScanService } from '../../services/ArtifactScanService';
import { ArtifactRetentionService } from '../../services/ArtifactRetentionService';

export interface ArtifactOpsServices {
  operationService: ArtifactOperationService;
  scanService: ArtifactScanService;
  retentionService: ArtifactRetentionService;
}

export class ArtifactOpsController {
  constructor(private services: ArtifactOpsServices) {}

  async trackOperation(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      if (!body.artifactId || !body.operation) {
        reply.code(400).send({ code: 400, message: 'artifactId and operation are required' });
        return;
      }
      const op = await this.services.operationService.trackOperation(tenantId, body);
      reply.code(201).send({ code: 201, message: 'Operation tracked', data: op });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async getOperationHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { artifactId } = request.params as { artifactId: string };
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const history = await this.services.operationService.getOperationHistory(tenantId, { artifactId });
      reply.send({ code: 200, message: 'OK', data: history, total: history.length });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async getArtifactStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { tenantId } = request.params as { tenantId: string };
      const stats = await this.services.operationService.getArtifactStats(tenantId);
      reply.send({ code: 200, message: 'OK', data: stats });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async defineRetentionPolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      if (!body.name || !body.maxAgeDays) {
        reply.code(400).send({ code: 400, message: 'name and maxAgeDays are required' });
        return;
      }
      const policy = await this.services.retentionService.defineRetentionPolicy(tenantId, body);
      reply.code(201).send({ code: 201, message: 'Policy created', data: policy });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async cleanup(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
    reply.send({ code: 200, message: 'Cleanup requires artifact registry integration. Use retention/evaluate instead.', tenantId });
  }

  async scanArtifact(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { artifactId } = request.params as { artifactId: string };
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const scan = await this.services.scanService.scanArtifact(tenantId, artifactId);
      reply.code(201).send({ code: 201, message: 'Scan initiated', data: scan });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async getScanReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { scanId } = request.params as { scanId: string };
      const report = await this.services.scanService.getScanReport(scanId);
      if (!report) {
        reply.code(404).send({ code: 404, message: 'Scan report not found' });
        return;
      }
      reply.send({ code: 200, message: 'OK', data: report });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async getArtifactScanReports(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { artifactId } = request.params as { artifactId: string };
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const reports = await this.services.scanService.getArtifactReports(artifactId);
      reply.send({ code: 200, message: 'OK', data: reports, total: reports.length });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async detectMalicious(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      if (!body.artifactId) {
        reply.code(400).send({ code: 400, message: 'artifactId is required' });
        return;
      }
      const result = await this.services.scanService.detectMaliciousArtifact(tenantId, body.artifactId);
      reply.send({ code: 200, message: 'OK', data: result });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async evaluateRetention(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.body as any;
      const artifacts = body.artifacts || [];
      const evaluations = await this.services.retentionService.evaluateRetention(tenantId, artifacts);
      reply.send({ code: 200, message: 'OK', data: evaluations });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async getRetentionReport(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const body = request.query as any;
      const artifacts = body.artifacts || [];
      const report = await this.services.retentionService.getRetentionReport(tenantId, artifacts);
      reply.send({ code: 200, message: 'OK', data: report });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async listPolicies(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const tenantId = (request.headers['x-tenant-id'] as string) || 'default';
      const policies = await this.services.retentionService.listPolicies(tenantId);
      reply.send({ code: 200, message: 'OK', data: policies, total: policies.length });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }

  async deletePolicy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { policyId } = request.params as { policyId: string };
      const deleted = await this.services.retentionService.deletePolicy(policyId);
      if (!deleted) {
        reply.code(404).send({ code: 404, message: 'Policy not found' });
        return;
      }
      reply.send({ code: 200, message: 'Policy deleted' });
    } catch (error: any) {
      reply.code(500).send({ code: 500, message: error.message });
    }
  }
}
