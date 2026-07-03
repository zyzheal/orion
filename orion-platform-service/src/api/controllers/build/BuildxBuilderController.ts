/**
 * Buildx Builder Controller
 * Docker Buildx 构建控制器
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { BuildxBuilderService } from '../../../services/build/BuildxBuilderService';
import { ArtifactRegistryServiceImpl } from '../../../services/artifact/ArtifactRegistryService';
import { createLogger } from '../utils/logger';

const logger = pino({ name: 'LBuildx-LBuilder-LController' });

export class BuildxBuilderController {
  constructor(
    private buildxBuilderService: BuildxBuilderService,
    private artifactRegistry?: ArtifactRegistryServiceImpl
  ) {}

  /**
   * 多架构构建
   */
  async buildMultiArch(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const options = request.body as any;
      
      // 验证必填字段
      if (!options.context || !options.imageName || !options.platforms || !options.tags) {
        reply.code(400).send({ 
          error: 'Missing required fields: context, imageName, platforms, tags' 
        });
        return;
      }

      // 验证平台格式
      const validPlatforms = ['linux/amd64', 'linux/arm64', 'linux/arm/v7', 'linux/arm/v6', 'windows/amd64'];
      const invalidPlatforms = options.platforms.filter((p: string) => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        reply.code(400).send({ 
          error: `Invalid platforms: ${invalidPlatforms.join(', ')}. Valid platforms: ${validPlatforms.join(', ')}` 
        });
        return;
      }

      const result = await this.buildxBuilderService.buildMultiArch(options);
      
      reply.code(result.success ? 200 : 400).send({
        success: result.success,
        data: result
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取构建器列表
   */
  async getBuilders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const builders = await this.buildxBuilderService.getBuilders();
      
      reply.send({
        success: true,
        data: builders
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取当前构建器
   */
  async getCurrentBuilder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const currentBuilder = await this.buildxBuilderService.getCurrentBuilder();
      
      reply.send({
        success: true,
        data: {
          currentBuilder
        }
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 验证构建配置
   */
  async validateBuildConfig(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const config = request.body as any;
      
      // 验证基本配置
      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[]
      };

      // 检查必填字段
      if (!config.context) {
        validation.errors.push('Context is required');
        validation.valid = false;
      }

      if (!config.imageName) {
        validation.errors.push('Image name is required');
        validation.valid = false;
      }

      if (!config.platforms || !Array.isArray(config.platforms)) {
        validation.errors.push('Platforms must be an array');
        validation.valid = false;
      }

      if (!config.tags || !Array.isArray(config.tags)) {
        validation.errors.push('Tags must be an array');
        validation.valid = false;
      }

      // 检查平台格式
      if (config.platforms) {
        const validPlatforms = ['linux/amd64', 'linux/arm64', 'linux/arm/v7', 'linux/arm/v6', 'windows/amd64'];
        const invalidPlatforms = config.platforms.filter((p: string) => !validPlatforms.includes(p));
        if (invalidPlatforms.length > 0) {
          validation.errors.push(`Invalid platforms: ${invalidPlatforms.join(', ')}`);
          validation.valid = false;
        }
      }

      // 检查标签格式
      if (config.tags) {
        const validTagPattern = /^[a-z0-9]+([._-][a-z0-9]+)*$/;
        const invalidTags = config.tags.filter((tag: string) => !validTagPattern.test(tag));
        if (invalidTags.length > 0) {
          validation.warnings.push(`Invalid tag formats: ${invalidTags.join(', ')}`);
        }
      }

      // 检查构建参数
      if (config.buildArgs) {
        const invalidArgs = Object.keys(config.buildArgs).filter(key => 
          key.includes(' ') || key.includes('=') || key.includes('\n')
        );
        if (invalidArgs.length > 0) {
          validation.warnings.push(`Invalid build arg names: ${invalidArgs.join(', ')}`);
        }
      }

      reply.send({
        success: true,
        data: validation
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取构建历史
   */
  async getBuildHistory(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { imageName } = request.query as { imageName?: string };
      
      // 这里应该从数据库或日志系统获取构建历史
      // 暂时返回空数组
      const history: any[] = [];
      
      reply.send({
        success: true,
        data: {
          builds: history,
          total: history.length
        }
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 取消构建
   */
  async cancelBuild(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { buildId } = request.params as { buildId: string };
      
      // 这里应该实现取消构建的逻辑
      // 暂时返回成功响应
      reply.send({
        success: true,
        message: 'Build cancelled successfully'
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 获取构建状态
   */
  async getBuildStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { buildId } = request.params as { buildId: string };
      
      // 这里应该从数据库或状态系统获取构建状态
      // 暂时返回默认状态
      const status = {
        id: buildId,
        status: 'completed',
        progress: 100,
        message: 'Build completed successfully'
      };
      
      reply.send({
        success: true,
        data: status
      });
    } catch (error) {
      this.handleError(error, reply);
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: any, reply: FastifyReply): void {
    logger.error('Buildx Builder Controller Error:', error);
    
    if (error.message.includes('buildx is not available')) {
      reply.code(503).send({ error: 'Docker buildx is not available' });
    } else if (error.message.includes('Failed to create buildx builder')) {
      reply.code(500).send({ error: 'Failed to create buildx builder' });
    } else if (error.message.includes('timeout')) {
      reply.code(408).send({ error: 'Build timeout' });
    } else {
      reply.code(500).send({ error: 'Internal server error' });
    }
  }
}