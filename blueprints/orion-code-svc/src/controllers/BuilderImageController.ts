/**
 * Builder Image Controller - 构建镜像 API 控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BuilderImageService } from '../services/BuilderImageService';
import {
  BuilderImageCreateInput,
  BuilderImageUpdateInput,
  PresetImageType,
  BuilderImageStatus,
  ImagePullPolicy,
} from '../models/BuilderImage';

export class BuilderImageController {
  private service: BuilderImageService;

  constructor(service: BuilderImageService) {
    this.service = service;
  }

  /**
   * POST /api/v1/build-images - 注册新的构建镜像
   */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = request.body as BuilderImageCreateInput;

    // 验证必填字段
    if (!input.name || !input.image) {
      reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'name and image are required',
      });
      return;
    }

    try {
      const image = await this.service.register(input);
      reply.status(201).send(image);
    } catch (error) {
      if (error instanceof Error) {
        reply.status(409).send({
          error: 'CONFLICT',
          message: error.message,
        });
      } else {
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to create builder image',
        });
      }
    }
  }

  /**
   * GET /api/v1/build-images - 获取镜像列表
   */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as Record<string, string>;

    try {
      const options: {
        type?: PresetImageType;
        status?: BuilderImageStatus;
        isPreset?: boolean;
        limit?: number;
        offset?: number;
      } = {};

      if (query.type) options.type = query.type as PresetImageType;
      if (query.status) options.status = query.status as BuilderImageStatus;
      if (query.isPreset !== undefined) {
        options.isPreset = query.isPreset === 'true';
      }
      if (query.limit) options.limit = parseInt(query.limit, 10);
      if (query.offset) options.offset = parseInt(query.offset, 10);

      const images = await this.service.list(options);
      reply.send(images);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to list builder images',
      });
    }
  }

  /**
   * GET /api/v1/build-images/:id - 获取镜像详情
   */
  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const image = await this.service.getById(id);
      if (!image) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Builder image '${id}' not found`,
        });
        return;
      }
      reply.send(image);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get builder image',
      });
    }
  }

  /**
   * GET /api/v1/build-images/presets - 获取预置镜像列表
   */
  async getPresets(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const images = await this.service.getPresets();
      reply.send(images);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get preset images',
      });
    }
  }

  /**
   * GET /api/v1/build-images/available - 获取可用镜像列表
   */
  async getAvailable(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const images = await this.service.getAvailable();
      reply.send(images);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get available images',
      });
    }
  }

  /**
   * GET /api/v1/build-images/type/:type - 按类型获取镜像
   */
  async getByType(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { type } = request.params as { type: string };

    try {
      const images = await this.service.getByType(type as PresetImageType);
      reply.send(images);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get builder images by type',
      });
    }
  }

  /**
   * PUT /api/v1/build-images/:id - 更新镜像
   */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };
    const input = request.body as BuilderImageUpdateInput;

    try {
      const image = await this.service.update(id, input);
      if (!image) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Builder image '${id}' not found`,
        });
        return;
      }
      reply.send(image);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to update builder image',
      });
    }
  }

  /**
   * POST /api/v1/build-images/:id/deprecate - 弃用镜像
   */
  async deprecate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const image = await this.service.deprecate(id);
      if (!image) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Builder image '${id}' not found`,
        });
        return;
      }
      reply.send(image);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to deprecate builder image',
      });
    }
  }

  /**
   * POST /api/v1/build-images/:id/restore - 恢复镜像
   */
  async restore(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const image = await this.service.restore(id);
      if (!image) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Builder image '${id}' not found`,
        });
        return;
      }
      reply.send(image);
    } catch (error) {
      reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to restore builder image',
      });
    }
  }

  /**
   * DELETE /api/v1/build-images/:id - 删除镜像
   */
  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as { id: string };

    try {
      const deleted = await this.service.delete(id);
      if (!deleted) {
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Builder image '${id}' not found`,
        });
        return;
      }
      reply.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot delete preset')) {
        reply.status(403).send({
          error: 'FORBIDDEN',
          message: error.message,
        });
      } else {
        reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Failed to delete builder image',
        });
      }
    }
  }
}
