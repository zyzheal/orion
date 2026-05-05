/**
 * SupplyChainController - 供应链安全 API 控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';

export class SupplyChainController extends BaseController {
  private supplyChainService: any;
  private dependencyGraphService: any;
  private artifactSigner: any;

  constructor(db: any) {
    super();
    // Lazy init to avoid import resolution issues
    this.supplyChainService = null;
    this.dependencyGraphService = null;
    this.artifactSigner = null;
    this._initServices(db);
  }

  private async _initServices(db: any) {
    const { SupplyChainService } = await import('../../services/security/SupplyChainService');
    const { DependencyGraphService } = await import('../../services/security/DependencyGraphService');
    const { ArtifactSigner } = await import('../../services/security/ArtifactSigner');
    this.supplyChainService = new SupplyChainService(db);
    this.dependencyGraphService = new DependencyGraphService(db);
    this.artifactSigner = new ArtifactSigner();
  }

  async generateSBOM(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { artifactId, pipelineId, format, version, components, dependencies } =
        request.body as any;

      const sbom = await this.supplyChainService.generateSBOM(tenantId, {
        artifactId,
        pipelineId,
        format,
        version,
        components,
        dependencies,
      });

      reply.status(201).send({ success: true, data: sbom });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getSBOM(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { sbomId } = request.params as { sbomId: string };
      const sbom = await this.supplyChainService.getSBOM(sbomId);

      if (!sbom) {
        return reply.status(404).send({ error: 'SBOM not found' });
      }

      reply.send({ success: true, data: sbom });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async analyzeDependencies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { package: packageName, version: packageVersion, depth } = request.params as any;

      const result = await this.supplyChainService.analyzeDependencies(tenantId, {
        packageName,
        packageVersion,
        depth: parseInt(depth, 10) || 3,
      });

      reply.send({ success: true, data: result });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getDependencyGraph(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { packages } = request.body as any;
      const graph = await this.dependencyGraphService.buildDependencyGraph(packages);
      reply.send({ success: true, data: graph });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async signArtifact(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { id: artifactId } = request.params as { id: string };
      const { privateKey, signedBy } = request.body as any;

      const result = await this.artifactSigner.signArtifact(artifactId, privateKey, signedBy);

      reply.status(201).send({ success: true, data: result });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async verifySignature(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: artifactId } = request.params as { id: string };
      const { signature, publicKey } = request.body as any;

      const verified = await this.supplyChainService.verifySignature(artifactId, signature);

      reply.send({ success: true, data: verified });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }

  async getSupplyChainReport(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { pipelineId } = request.params as { pipelineId?: string };

      const report = await this.supplyChainService.getSupplyChainReport(tenantId, pipelineId);

      reply.send({ success: true, data: report });
    } catch (error: any) {
      reply.status(500).send({ error: error.message });
    }
  }
}
