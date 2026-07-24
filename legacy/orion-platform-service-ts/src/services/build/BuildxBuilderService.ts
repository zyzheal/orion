/**
 * Buildx Builder Service
 * Docker Buildx 多架构构建服务
 */

import { createLogger } from '../../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ArtifactRegistryServiceImpl } from '../artifact/ArtifactRegistryService';
import { ArtifactRegistryService } from '../../models/Artifact';
import { ArtifactType } from '../../models/Artifact';
import { OrionError, ErrorCode } from '../../errors';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('BuildxBuilderService');
const execAsync = promisify(exec);

export interface BuildOptions {
  context: string;
  dockerfile?: string;
  imageName: string;
  tags: string[];
  platforms: string[];
  buildArgs?: Record<string, string>;
  labels?: Record<string, string>;
  cacheFrom?: string[];
  cacheTo?: string[];
  push?: boolean;
  progress?: 'auto' | 'plain' | 'tty';
  noCache?: boolean;
  pull?: boolean;
}

export interface BuildResult {
  success: boolean;
  imageId?: string;
  platforms: string[];
  size: number;
  duration: number;
  logs: string[];
  errors: string[];
}

export interface MultiArchBuildResult {
  success: boolean;
  results: BuildResult[];
  summary: {
    totalPlatforms: number;
    successfulPlatforms: number;
    failedPlatforms: number;
    totalSize: number;
    duration: number;
  };
}

export class BuildxBuilderService {
  private artifactRegistry?: ArtifactRegistryService;

  constructor(artifactRegistry?: ArtifactRegistryService) {
    this.artifactRegistry = artifactRegistry;
  }

  /**
   * 多架构构建
   */
  async buildMultiArch(options: BuildOptions): Promise<MultiArchBuildResult> {
    const startTime = Date.now();
    const results: BuildResult[] = [];
    let successfulPlatforms = 0;
    let totalSize = 0;

    try {
      logger.info({
        imageName: options.imageName,
        platforms: options.platforms,
        tags: options.tags
      }, 'Starting multi-arch build');

      // 检查 buildx 是否可用
      await this.checkBuildxAvailability();

      // 创建构建器实例
      const builderName = `orion-builder-${Date.now()}`;
      await this.createBuilder(builderName);

      try {
        // 构建每个平台
        for (const platform of options.platforms) {
          const platformStartTime = Date.now();
          const result = await this.buildPlatform({
            ...options,
            platform,
            builderName
          });
          
          results.push(result);
          
          if (result.success) {
            successfulPlatforms++;
            totalSize += result.size || 0;
          }
        }

        // 推送镜像到仓库
        if (options.push && successfulPlatforms > 0) {
          await this.pushImages(options);
        }

        // 保存到制品仓库
        if (this.artifactRegistry && successfulPlatforms > 0) {
          await this.saveToArtifactRegistry(options, results);
        }

        const duration = Date.now() - startTime;

        return {
          success: successfulPlatforms === options.platforms.length,
          results,
          summary: {
            totalPlatforms: options.platforms.length,
            successfulPlatforms,
            failedPlatforms: options.platforms.length - successfulPlatforms,
            totalSize,
            duration
          }
        };

      } finally {
        // 清理构建器
        await this.cleanupBuilder(builderName);
      }

    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(),
        error,
        options
      }, 'Multi-arch build failed');

      return {
        success: false,
        results,
        summary: {
          totalPlatforms: options.platforms.length,
          successfulPlatforms,
          failedPlatforms: options.platforms.length - successfulPlatforms,
          totalSize,
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 原生单命令多架构构建
   *
   * 使用 `docker buildx build --platform linux/amd64,linux/arm64` 单次命令
   * 构建多平台镜像，自动创建 manifest list。比串行调用 buildPlatform() 快得多。
   */
  async buildMultiArchNative(options: BuildOptions): Promise<BuildResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];

    if (options.platforms.length === 0) {
      return {
        success: false,
        platforms: [],
        size: 0,
        duration: 0,
        logs,
        errors: ['No platforms specified'],
      };
    }

    try {
      await this.checkBuildxAvailability();

      // 构建单命令
      const command = this.buildMultiArchCommand(options);
      const cwd = options.context || '.';

      logger.info({ command, platforms: options.platforms }, 'Starting native multi-arch build');

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 60 * 60 * 1000, // 1 hour timeout for large builds
        maxBuffer: 1024 * 1024 * 50,
      });

      logs.push(stdout);
      if (stderr) logs.push(stderr);

      const imageId = this.parseImageId(stdout);
      const duration = Date.now() - startTime;

      // 推送到仓库
      if (options.push) {
        await this.pushImages(options);
      }

      // 保存到制品仓库
      if (this.artifactRegistry) {
        await this.saveToArtifactRegistry(options, [{
          success: true,
          imageId,
          platforms: options.platforms,
          size: 0,
          duration,
          logs,
          errors: [],
        }]);
      }

      logger.info({ platforms: options.platforms, duration }, 'Native multi-arch build completed');

      return {
        success: true,
        imageId,
        platforms: options.platforms,
        size: 0,
        duration,
        logs,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      logger.error({ traceId: getCurrentTraceId(), error: errorMessage }, 'Native multi-arch build failed');

      return {
        success: false,
        platforms: options.platforms,
        size: 0,
        duration: Date.now() - startTime,
        logs,
        errors,
      };
    }
  }

  /**
   * 构建多平台 docker buildx 命令
   */
  private buildMultiArchCommand(options: BuildOptions): string {
    let command = `docker buildx build --platform ${options.platforms.join(',')}`;

    // 标签
    const tags = [options.tags[0] || 'latest', ...options.tags.slice(1)];
    for (const tag of tags) {
      command += ` -t ${options.imageName}:${tag}`;
    }

    // 构建参数
    if (options.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        command += ` --build-arg ${key}=${value}`;
      }
    }

    // 标签
    if (options.labels) {
      for (const [key, value] of Object.entries(options.labels)) {
        command += ` --label ${key}=${value}`;
      }
    }

    // 缓存
    if (options.cacheFrom && options.cacheFrom.length > 0) {
      command += ` --cache-from ${options.cacheFrom.join(',')}`;
    }
    if (options.cacheTo && options.cacheTo.length > 0) {
      command += ` --cache-to ${options.cacheTo.join(',')}`;
    }

    // 其他选项
    if (options.push) command += ' --push';
    if (options.progress) command += ` --progress ${options.progress}`;
    if (options.noCache) command += ' --no-cache';
    if (options.pull) command += ' --pull';

    // Dockerfile
    if (options.dockerfile) {
      command += ` -f ${options.dockerfile}`;
    }

    // 上下文
    command += ` ${options.context}`;

    return command;
  }

  /**
   * 单平台构建
   */
  async buildPlatform(options: {
    context: string;
    dockerfile?: string;
    imageName: string;
    platform: string;
    tags: string[];
    buildArgs?: Record<string, string>;
    labels?: Record<string, string>;
    cacheFrom?: string[];
    cacheTo?: string[];
    push?: boolean;
    progress?: 'auto' | 'plain' | 'tty';
    noCache?: boolean;
    pull?: boolean;
    builderName: string;
  }): Promise<BuildResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];

    try {
      // 构建 buildx 命令
      const buildCommand = this.buildBuildxCommand(options);
      
      logger.info({
        command: buildCommand,
        platform: options.platform
      }, 'Executing buildx build command');

      // 执行构建
      const { stdout, stderr } = await execAsync(buildCommand, {
        timeout: 30 * 60 * 1000, // 30分钟超时
        maxBuffer: 1024 * 1024 * 10 // 10MB缓冲区
      });

      logs.push(stdout);
      if (stderr) {
        logs.push(stderr);
      }

      // 解析构建结果
      const imageId = this.parseImageId(stdout);
      const size = this.parseImageSize(stdout);

      logger.info({
        platform: options.platform,
        imageId,
        size,
        duration: Date.now() - startTime
      }, 'Platform build completed');

      return {
        success: true,
        imageId,
        platforms: [options.platform],
        size,
        duration: Date.now() - startTime,
        logs,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      logger.error({ traceId: getCurrentTraceId(),
        error,
        platform: options.platform
      }, 'Platform build failed');

      return {
        success: false,
        platforms: [options.platform],
        size: 0,
        duration: Date.now() - startTime,
        logs,
        errors
      };
    }
  }

  /**
   * 推送镜像
   */
  async pushImages(options: {
    imageName: string;
    tags: string[];
    platforms: string[];
  }): Promise<void> {
    try {
      logger.info({
        imageName: options.imageName,
        tags: options.tags
      }, 'Pushing multi-arch images');

      // 使用 buildx 推送多架构镜像
      const pushCommand = `docker buildx build --push --platform ${options.platforms.join(',')} -t ${options.imageName}:${options.tags.join(',')} .`;
      
      await execAsync(pushCommand, {
        timeout: 20 * 60 * 1000 // 20分钟超时
      });

      logger.info({
        imageName: options.imageName,
        tags: options.tags
      }, 'Images pushed successfully');

    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(),
        error,
        imageName: options.imageName
      }, 'Failed to push images');
      throw error;
    }
  }

  /**
   * 保存到制品仓库
   */
  private async saveToArtifactRegistry(options: BuildOptions, results: BuildResult[]): Promise<void> {
    try {
      const successfulResults = results.filter(r => r.success);
      
      for (const result of successfulResults) {
        for (const tag of options.tags) {
          const artifactData = {
            name: options.imageName,
            namespace: 'docker',
            version: tag,
            type: ArtifactType.DOCKER_IMAGE,
            sizeBytes: result.size || 0,
            metadata: {
              platforms: result.platforms,
              buildTime: new Date().toISOString(),
              imageId: result.imageId,
              buildArgs: options.buildArgs,
              labels: options.labels
            },
            storagePath: `${options.imageName}:${tag}`,
            createdBy: 'system'
          };

          if (this.artifactRegistry) {
            await this.artifactRegistry.create(artifactData);
          }
        }
      }

      logger.info({
        imageCount: successfulResults.length,
        tagCount: options.tags.length
      }, 'Artifacts saved to registry');

    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(),
        error,
        imageName: options.imageName
      }, 'Failed to save artifacts to registry');
      throw error;
    }
  }

  /**
   * 检查 buildx 可用性
   */
  private async checkBuildxAvailability(): Promise<void> {
    try {
      await execAsync('docker buildx version');
    } catch (error) {
      throw new OrionError('Docker buildx is not available. Please install Docker buildx.', ErrorCode.SERVICE_UNAVAILABLE);
    }
  }

  /**
   * 创建构建器实例
   */
  private async createBuilder(name: string): Promise<void> {
    try {
      await execAsync(`docker buildx create --name ${name} --use`);
      logger.info({ name }, 'Buildx builder created');
    } catch (error) {
      throw new OrionError(`Failed to create buildx builder: ${error}`, 'OPERATION_FAILED')
    }
  }

  /**
   * 清理构建器
   */
  private async cleanupBuilder(name: string): Promise<void> {
    try {
      await execAsync(`docker buildx rm ${name} --force`);
      logger.info({ name }, 'Buildx builder cleaned up');
    } catch (error) {
      logger.warn({ traceId: getCurrentTraceId(),
        error,
        name
      }, 'Failed to cleanup buildx builder');
    }
  }

  /**
   * 构建 buildx 命令
   */
  private buildBuildxCommand(options: {
    context: string;
    dockerfile?: string;
    imageName: string;
    platform: string;
    tags: string[];
    buildArgs?: Record<string, string>;
    labels?: Record<string, string>;
    cacheFrom?: string[];
    cacheTo?: string[];
    push?: boolean;
    progress?: 'auto' | 'plain' | 'tty';
    noCache?: boolean;
    pull?: boolean;
    builderName: string;
  }): string {
    let command = `docker buildx build --platform ${options.platform} --builder ${options.builderName}`;

    // 添加标签
    command += ` -t ${options.imageName}:${options.tags.join(',')}`;

    // 添加构建参数
    if (options.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        command += ` --build-arg ${key}=${value}`;
      }
    }

    // 添加标签
    if (options.labels) {
      for (const [key, value] of Object.entries(options.labels)) {
        command += ` --label ${key}=${value}`;
      }
    }

    // 添加缓存配置
    if (options.cacheFrom && options.cacheFrom.length > 0) {
      command += ` --cache-from ${options.cacheFrom.join(',')}`;
    }

    if (options.cacheTo && options.cacheTo.length > 0) {
      command += ` --cache-to ${options.cacheTo.join(',')}`;
    }

    // 其他选项
    if (options.push) {
      command += ' --push';
    }

    if (options.progress) {
      command += ` --progress ${options.progress}`;
    }

    if (options.noCache) {
      command += ' --no-cache';
    }

    if (options.pull) {
      command += ' --pull';
    }

    // 添加 Dockerfile
    if (options.dockerfile) {
      command += ` -f ${options.dockerfile}`;
    }

    // 添加构建上下文
    command += ` ${options.context}`;

    return command;
  }

  /**
   * 解析镜像 ID
   */
  private parseImageId(stdout: string): string | undefined {
    const match = stdout.match(/(?<=sha256:)[a-f0-9]{64}/);
    return match ? match[0] : undefined;
  }

  /**
   * 解析镜像大小
   */
  private parseImageSize(stdout: string): number {
    const match = stdout.match(/(?<=size: )(\d+(?:\.\d+)?\s*(?:KB|MB|GB))/);
    if (!match) return 0;

    const sizeStr = match[1];
    const size = parseFloat(sizeStr);
    const unit = sizeStr.match(/[A-Z]+/)?.[0] || 'MB';

    switch (unit) {
      case 'KB':
        return size * 1024;
      case 'GB':
        return size * 1024 * 1024 * 1024;
      default:
        return size * 1024 * 1024;
    }
  }

  /**
   * 获取构建器信息
   */
  async getBuilders(): Promise<any[]> {
    try {
      const { stdout } = await execAsync('docker buildx ls');
      return this.parseBuildersList(stdout);
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), error }, 'Failed to get builders');
      throw error;
    }
  }

  /**
   * 获取当前构建器
   */
  async getCurrentBuilder(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('docker buildx inspect --bootstrap');
      const match = stdout.match(/(?<=Name: )\S+/);
      return match ? match[0] : null;
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), error }, 'Failed to get current builder');
      return null;
    }
  }

  /**
   * 解析构建器列表
   */
  private parseBuildersList(stdout: string): any[] {
    const builders = [];
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      if (line.includes('docker-container') || line.includes('default')) {
        const parts = line.split(/\s+/);
        const name = parts[0];
        const driver = parts[1];
        const status = parts[2];
        
        builders.push({
          name,
          driver,
          status
        });
      }
    }
    
    return builders;
  }
}