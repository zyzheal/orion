/**
 * ArtifactController — controller for artifact registry operations.
 */
import { FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactRegistryServiceImpl } from '../../services/ArtifactRegistryService';

export class ArtifactController {
  constructor(private artifactService: ArtifactRegistryServiceImpl) {}

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const { name, namespace, version, type, sizeBytes, checksumSha256, checksumSha512, metadata, storagePath, createdBy } = body;
    if (!name || !namespace || !version || !type) {
      return reply.code(400).send({ error: 'Missing required fields: name, namespace, version, type' });
    }
    try {
      const artifact = await this.artifactService.create({
        name, namespace, version, type, sizeBytes, checksumSha256, checksumSha512, metadata, storagePath, createdBy: createdBy || 'system',
      });
      return reply.code(201).send({ data: artifact });
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return reply.code(409).send({ error: error.message });
      }
      throw error;
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const options = {
      namespace: query.namespace,
      type: query.type,
      status: query.status,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };
    try {
      const result = await this.artifactService.list(options);
      return reply.send({ data: result.artifacts, total: result.total });
    } catch (error: any) {
      throw error;
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const artifact = await this.artifactService.get(params.id);
      return reply.send({ data: artifact });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any;
    try {
      const artifact = await this.artifactService.update({ id: params.id, ...body });
      return reply.send({ data: artifact });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      await this.artifactService.delete(params.id);
      return reply.send({ success: true });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  }

  async addTags(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any;
    const tags = body.tags || [];
    if (!Array.isArray(tags) || tags.length === 0) {
      return reply.code(400).send({ error: 'Missing required field: tags (array)' });
    }
    try {
      await this.artifactService.addTags(params.id, tags);
      return reply.send({ success: true });
    } catch (error: any) {
      throw error;
    }
  }

  async removeTags(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any;
    const tags = body.tags || [];
    if (!Array.isArray(tags) || tags.length === 0) {
      return reply.code(400).send({ error: 'Missing required field: tags (array)' });
    }
    try {
      await this.artifactService.removeTags(params.id, tags);
      return reply.send({ success: true });
    } catch (error: any) {
      throw error;
    }
  }

  async getTags(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const tags = await this.artifactService.getTags(params.id);
      return reply.send({ data: tags });
    } catch (error: any) {
      throw error;
    }
  }

  async download(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const query = request.query as any;
    try {
      const artifact = await this.artifactService.download({
        artifactId: params.id,
        downloadedBy: query.downloadedBy || 'anonymous',
        ipAddress: query.ipAddress,
        userAgent: query.userAgent,
      });
      return reply.send({ data: artifact });
    } catch (error: any) {
      throw error;
    }
  }

  async getDownloadHistory(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const history = await this.artifactService.getDownloadHistory(params.id);
      return reply.send({ data: history });
    } catch (error: any) {
      throw error;
    }
  }

  async search(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    if (!query.q) {
      return reply.code(400).send({ error: 'Missing required query param: q' });
    }
    try {
      const results = await this.artifactService.search(query.q);
      return reply.send({ data: results, total: results.length });
    } catch (error: any) {
      throw error;
    }
  }

  async deprecate(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    try {
      const artifact = await this.artifactService.deprecate(params.id);
      return reply.send({ data: artifact });
    } catch (error: any) {
      throw error;
    }
  }

  async quarantine(request: FastifyRequest, reply: FastifyReply) {
    const params = request.params as any;
    const body = request.body as any;
    const reason = body.reason || 'No reason provided';
    try {
      const artifact = await this.artifactService.quarantine(params.id, reason);
      return reply.send({ data: artifact });
    } catch (error: any) {
      throw error;
    }
  }
}
