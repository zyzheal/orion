/**
 * Artifact Registry Controller
 * 制品仓库控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ArtifactRegistryServiceImpl } from '../../../services/artifact/ArtifactRegistryService';
import pino from 'pino';

const logger = pino({ name: 'LArtifact-LController' });
import {
  CreateArtifactInput,
  UpdateArtifactInput,
  ArtifactQueryOptions,
  ArtifactDownloadOptions,
  ArtifactType,
  ArtifactStatus
} from '../../../models/Artifact';

export class ArtifactController {
  constructor(private artifactService: ArtifactRegistryServiceImpl) {}

  /**
   * 创建制品
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = request.body as CreateArtifactInput;
      
      // 验证必填字段
      if (!input.name || !input.namespace || !input.version || !input.type) {
        reply.code(400).send({ error: 'Missing required fields: name, namespace, version, type' });
        return;
      }

      // 验证制品类型
      if (!Object.values(ArtifactType).includes(input.type)) {
        reply.code(400).send({ error: 'Invalid artifact type' });
        return;
      }

      const artifact = await this.artifactService.create(input);
      
      reply.code(201).send({
        success: true,
        data: artifact
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取制品详情
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      
      const artifact = await this.artifactService.get(id);
      
      reply.send({
        success: true,
        data: artifact
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取制品列表
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = request.query as any;
      
      const options: ArtifactQueryOptions = {
        namespace: query.namespace,
        name: query.name,
        type: query.type as ArtifactType,
        status: query.status as ArtifactStatus,
        tags: query.tags ? query.tags.split(',') : undefined,
        limit: parseInt(query.limit) || 20,
        offset: parseInt(query.offset) || 0,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'DESC'
      };

      const result = await this.artifactService.list(options);
      
      reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 更新制品
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const input = request.body as UpdateArtifactInput;
      
      const artifact = await this.artifactService.update({ ...input, id });
      
      reply.send({
        success: true,
        data: artifact
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 删除制品
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      
      await this.artifactService.delete(id);
      
      reply.send({
        success: true,
        message: 'Artifact deleted successfully'
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 添加标签
   */
  async addTags(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const { tags } = request.body as { tags: string[] };
      
      if (!tags || !Array.isArray(tags)) {
        reply.code(400).send({ error: 'Tags must be an array' });
        return;
      }

      await this.artifactService.addTags(id, tags);
      
      reply.send({
        success: true,
        message: 'Tags added successfully'
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 移除标签
   */
  async removeTags(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const { tags } = request.body as { tags: string[] };
      
      if (!tags || !Array.isArray(tags)) {
        reply.code(400).send({ error: 'Tags must be an array' });
        return;
      }

      await this.artifactService.removeTags(id, tags);
      
      reply.send({
        success: true,
        message: 'Tags removed successfully'
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取标签
   */
  async getTags(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      
      const tags = await this.artifactService.getTags(id);
      
      reply.send({
        success: true,
        data: tags
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 下载制品
   */
  async download(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const user = (request as any).user as any; // 假设已认证
      const clientIp = request.ip;
      const userAgent = request.headers['user-agent'];
      
      const options: ArtifactDownloadOptions = {
        artifactId: id,
        downloadedBy: user?.id || 'anonymous',
        ipAddress: clientIp,
        userAgent
      };

      const artifact = await this.artifactService.download(options);
      
      // 设置响应头
      reply.header('Content-Disposition', `attachment; filename="${artifact.name}-${artifact.version}"`);
      reply.header('Content-Type', this.getContentType(artifact.type));
      reply.header('Content-Length', artifact.sizeBytes);
      
      // 这里应该返回实际的文件内容
      // 暂时返回 JSON 响应
      reply.send({
        success: true,
        data: {
          name: artifact.name,
          version: artifact.version,
          type: artifact.type,
          size: artifact.sizeBytes
        }
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取下载历史
   */
  async getDownloadHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      
      const history = await this.artifactService.getDownloadHistory(id);
      
      reply.send({
        success: true,
        data: history
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 搜索制品
   */
  async search(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { q } = request.query as { q: string };
      
      if (!q || q.trim() === '') {
        reply.code(400).send({ error: 'Search query is required' });
        return;
      }

      const results = await this.artifactService.search(q);
      
      reply.send({
        success: true,
        data: results
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 制品升级
   */
  async promote(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const { targetNamespace } = request.body as { targetNamespace: string };
      
      if (!targetNamespace) {
        reply.code(400).send({ error: 'Target namespace is required' });
        return;
      }

      const artifact = await this.artifactService.promote(id, targetNamespace);
      
      reply.send({
        success: true,
        data: artifact
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 废弃制品
   */
  async deprecate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      
      const artifact = await this.artifactService.deprecate(id);
      
      reply.send({
        success: true,
        data: artifact
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 隔离制品
   */
  async quarantine(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      
      if (!reason) {
        reply.code(400).send({ error: 'Quarantine reason is required' });
        return;
      }

      const artifact = await this.artifactService.quarantine(id, reason);
      
      reply.send({
        success: true,
        data: artifact
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: any, reply: FastifyReply): void {
    logger.error('Artifact Controller Error:', error);
    
    if (error.message.includes('not found')) {
      reply.code(404).send({ error: error.message });
    } else if (error.message.includes('already exists')) {
      reply.code(409).send({ error: error.message });
    } else if (error.message.includes('validation')) {
      reply.code(400).send({ error: error.message });
    } else {
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  /**
   * 获取内容类型
   */
  private getContentType(type: string): string {
    const contentTypes: Record<string, string> = {
      'DOCKER_IMAGE': 'application/vnd.docker.image.rootfs.diff.tar.gzip',
      'HELM_CHART': 'application/vnd.cncf.helm.chart.v2+json',
      'FUNCTION_PACKAGE': 'application/zip',
      'MODEL_FILE': 'application/octet-stream',
      'PLUGIN_PACKAGE': 'application/octet-stream',
      'CONFIG_FILE': 'text/plain',
      'BUILD_OUTPUT': 'application/octet-stream',
      'TEST_REPORT': 'application/xml'
    };
    
    return contentTypes[type] || 'application/octet-stream';
  }
}