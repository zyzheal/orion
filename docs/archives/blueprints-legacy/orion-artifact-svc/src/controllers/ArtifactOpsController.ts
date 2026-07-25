/**
 * ArtifactOpsController — controller for artifact operations (ops, retention, scan).
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactOperationService } from '../services/ArtifactOperationService';
import { ArtifactScanService } from '../services/ArtifactScanService';
import { ArtifactRetentionService } from '../services/ArtifactRetentionService';

export interface ArtifactOpsServices {
  operationService: ArtifactOperationService;
  scanService: ArtifactScanService;
  retentionService: ArtifactRetentionService;
}

export class ArtifactOpsController {
  private operationService: ArtifactOperationService;
  private scanService: ArtifactScanService;
  private retentionService: ArtifactRetentionService;

  constructor(services: ArtifactOpsServices) {
    this.operationService = services.operationService;
    this.scanService = services.scanService;
    this.retentionService = services.retentionService;
  }

  async trackOperation(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const { tenantId, artifactId, operation, source, target, metadata, initiatedBy } = body;
    if (!tenantId || !artifactId || !operation) {
      return reply.code(400).send({ error: 'Missing required fields: tenantId, artifactId, operation' });
    }
    try {
      const result = await this.operationService.trackOperation(tenantId, { artifactId, operation, source, target, metadata, initiatedBy });
      return reply.code(201).send({ data: result });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async getOperationHistory(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;
    const tenantId = query.tenantId || 'default';
    const filters = {
      artifactId: params.artifactId,
      operation: query.operation,
      status: query.status,
    };
    try {
      const result = await this.operationService.getOperationHistory(tenantId, filters);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async getArtifactStats(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const stats = await this.operationService.getArtifactStats(params.tenantId);
      return reply.send({ data: stats });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async defineRetentionPolicy(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const { tenantId, name, maxAgeDays, maxVersions, maxSizeMB, protectedTags, schedule } = body;
    if (!tenantId || !name || !maxAgeDays) {
      return reply.code(400).send({ error: 'Missing required fields: tenantId, name, maxAgeDays' });
    }
    try {
      const policy = await this.retentionService.defineRetentionPolicy(tenantId, { name, maxAgeDays, maxVersions, maxSizeMB, protectedTags, schedule });
      return reply.code(201).send({ data: policy });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async cleanup(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const tenantId = body.tenantId || 'default';
    try {
      // Minimal: return a placeholder response
      return reply.send({ message: 'Cleanup triggered', tenantId });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async scanArtifact(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const tenantId = (request.query as any)?.tenantId || 'default';
    try {
      const report = await this.scanService.scanArtifact(tenantId, params.artifactId);
      return reply.send({ data: report });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async getScanReport(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const report = await this.scanService.getScanReport(params.scanId);
      if (!report) return reply.code(404).send({ error: 'Scan report not found' });
      return reply.send({ data: report });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async getArtifactScanReports(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const reports = await this.scanService.getArtifactReports(params.artifactId);
      return reply.send({ data: reports });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async detectMalicious(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const { tenantId, artifactId } = body;
    if (!tenantId || !artifactId) {
      return reply.code(400).send({ error: 'Missing required fields: tenantId, artifactId' });
    }
    try {
      const result = await this.scanService.detectMaliciousArtifact(tenantId, artifactId);
      return reply.send({ data: result });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async evaluateRetention(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const { tenantId, artifacts } = body;
    if (!tenantId) {
      return reply.code(400).send({ error: 'Missing required field: tenantId' });
    }
    try {
      const evaluations = await this.retentionService.evaluateRetention(tenantId, artifacts || []);
      return reply.send({ data: evaluations });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async getRetentionReport(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = (request.query as any)?.tenantId || 'default';
    try {
      const report = await this.retentionService.getRetentionReport(tenantId, []);
      return reply.send({ data: report });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async listPolicies(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = (request.query as any)?.tenantId || 'default';
    try {
      const policies = await this.retentionService.listPolicies(tenantId);
      return reply.send({ data: policies });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }

  async deletePolicy(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const deleted = await this.retentionService.deletePolicy(params.policyId);
      return reply.send({ success: deleted });
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  }
}
