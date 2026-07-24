/**
 * SupplyChainController - 供应链安全 API 控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseController } from './BaseController';

export class SupplyChainController extends BaseController {
  private sbomService: any;
  private dependencyGraphService: any;
  private artifactSigner: any;

  constructor(db: any) {
    super();
    // Lazy init to avoid import resolution issues
    this.sbomService = null;
    this.dependencyGraphService = null;
    this.artifactSigner = null;
    this._initServices(db);
  }

  private async _initServices(db: any) {
    const { SbomService } = await import('../../services/supply-chain/SbomService');
    const { DependencyGraphService } = await import('../../services/security/DependencyGraphService');
    const { ArtifactSigner } = await import('../../services/security/ArtifactSigner');
    this.sbomService = new SbomService(db);
    this.dependencyGraphService = new DependencyGraphService(db);
    this.artifactSigner = new ArtifactSigner();
  }

  /**
   * POST /supply-chain/sbom - Generate SBOM
   */
  async generateSBOM(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const body = request.body as any;
      const { artifactId, pipelineId, format, version, components, dependencies } = body;

      if (!artifactId || !components) {
        return reply.status(400).send({ success: false, error: 'artifactId and components are required' });
      }

      const sbom = await this.sbomService.generateSBOM(tenantId, {
        artifactId,
        pipelineId,
        format,
        version,
        components,
        dependencies: dependencies || [],
      });

      reply.status(201).send({ success: true, data: sbom });
    } catch (error: any) {
      this.sendInternalError(reply, error);
    }
  }

  /**
   * GET /supply-chain/sbom/:sbomId - Get SBOM
   */
  async getSBOM(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { sbomId } = request.params as { sbomId: string };
      const tenantId = this.getTenantId(request);
      const sbom = await this.sbomService.getSBOM(sbomId, tenantId);

      if (!sbom) {
        return reply.status(404).send({ success: false, error: 'SBOM not found' });
      }

      reply.send({ success: true, data: sbom });
    } catch (error: any) {
      this.sendInternalError(reply, error);
    }
  }

  /**
   * GET /supply-chain/dependencies/:package/:version/analyze - Analyze dependencies
   */
  async analyzeDependencies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { package: packageName, version: packageVersion } = request.params as any;
      const query = request.query as any;
      const depth = query.depth ? parseInt(query.depth, 10) : 3;

      if (!packageName || !packageVersion) {
        return reply.status(400).send({ success: false, error: 'package and version are required' });
      }

      const result = await this.sbomService.analyzeDependencies(tenantId, {
        packageName,
        packageVersion,
        depth,
      });

      reply.send({ success: true, data: result });
    } catch (error: any) {
      this.sendInternalError(reply, error);
    }
  }

  /**
   * POST /supply-chain/dependencies/graph - Get dependency graph
   */
  async getDependencyGraph(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { packages } = request.body as any;

      if (!packages || !Array.isArray(packages)) {
        return reply.status(400).send({ success: false, error: 'packages array is required' });
      }

      const graph = await this.dependencyGraphService.buildDependencyGraph(packages);
      reply.send({ success: true, data: graph });
    } catch (error: any) {
      this.sendInternalError(reply, error);
    }
  }

  /**
   * POST /supply-chain/artifacts/:id/sign - Sign artifact
   */
  async signArtifact(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const user = this.getUser(request);
      const { id: artifactId } = request.params as { id: string };
      const { privateKey, signedBy, signatureType } = request.body as any;

      if (!artifactId) {
        return reply.status(400).send({ success: false, error: 'artifactId is required' });
      }

      // Generate signature
      const signerResult = await this.artifactSigner.signArtifact(
        artifactId,
        privateKey || '',
        signedBy || user?.username || 'system',
      );

      // Persist signature to artifact_signatures table via service
      const persisted = await this.sbomService.persistArtifactSignature(
        tenantId,
        artifactId,
        signerResult.signature,
        signedBy || user?.username || 'system',
        signatureType || 'sha256',
      );

      reply.status(201).send({ success: true, data: { ...signerResult, persistedId: persisted?.id } });
    } catch (error: any) {
      this.sendInternalError(reply, error);
    }
  }

  /**
   * POST /supply-chain/artifacts/:id/verify - Verify signature
   */
  async verifySignature(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: artifactId } = request.params as { id: string };
      const { signature, publicKey } = request.body as any;

      if (!artifactId || !signature) {
        return reply.status(400).send({ success: false, error: 'artifactId and signature are required' });
      }

      const verified = await this.sbomService.verifySignature(artifactId, signature);

      reply.send({ success: true, data: verified });
    } catch (error: any) {
      this.sendInternalError(reply, error);
    }
  }

  /**
   * GET /supply-chain/reports/:pipelineId - Get supply chain report
   */
  async getSupplyChainReport(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tenantId = this.getTenantId(request);
      const { pipelineId } = request.params as { pipelineId?: string };

      if (!pipelineId) {
        return reply.status(400).send({ success: false, error: 'pipelineId is required' });
      }

      const report = await this.sbomService.getSupplyChainReport(tenantId, pipelineId);

      reply.send({ success: true, data: report });
    } catch (error: any) {
      this.sendInternalError(reply, error);
    }
  }
}
