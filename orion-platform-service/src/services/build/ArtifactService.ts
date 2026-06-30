/**
 * Artifact Service - 构建产物管理服务
 *
 * 职责：
 * - Artifact 上传和下载
 * - Artifact 存储管理
 * - Artifact 过期清理
 *
 * 持久化方式：PostgreSQL Repository (BuildArtifactRepository)
 */

import { BuildArtifactRepository } from '../../repositories/BuildArtifactRepository';

/**
 * Build Architecture types for multi-architecture artifact support
 */
export type BuildArchitecture = 'amd64' | 'arm64' | 'arm/v7' | 'arm/v6' | 'ppc64le' | 's390x' | 'riscv64';

/**
 * Default supported architectures for parallel builds
 */
export const DEFAULT_ARCHITECTURES: BuildArchitecture[] = ['amd64', 'arm64'];

/**
 * Multi-architecture build configuration
 */
export interface MultiArchBuildConfig {
  /** Target architectures to build for */
  architectures: BuildArchitecture[];
  /** Whether to build in parallel (true) or sequentially (false) */
  parallel?: boolean;
  /** Maximum concurrent builds (default: architectures.length) */
  maxConcurrency?: number;
  /** Base image to use */
  baseImage?: string;
  /** Platform-specific build arguments */
  archBuildArgs?: Record<BuildArchitecture, Record<string, string>>;
  /** Cross-compilation settings */
  crossCompile?: boolean;
}

/**
 * Result of a single architecture build
 */
export interface ArchBuildResult {
  architecture: BuildArchitecture;
  success: boolean;
  artifactId: string;
  durationMs: number;
  error?: string;
  fileSize?: number;
  checksum?: string;
}

/**
 * Result of a multi-architecture build
 */
export interface MultiArchBuildResult {
  buildId: string;
  results: ArchBuildResult[];
  totalDurationMs: number;
  successCount: number;
  failureCount: number;
  allSuccessful: boolean;
}

/**
 * Artifact 扩展创建输入，支持多架构
 */
export interface MultiArchArtifactCreateInput extends ArtifactCreateInput {
  /** Target architecture (default: 'amd64') */
  architecture?: BuildArchitecture;
  /** Whether this is part of a multi-arch manifest */
  isMultiArchManifest?: boolean;
  /** Associated manifest ID (for individual arch artifacts) */
  manifestId?: string;
  /** List of architectures in the manifest (for manifest artifacts) */
  manifestArchitectures?: BuildArchitecture[];
}

// Re-export types from models for backward compatibility
export { ArtifactType, ArtifactStorageType } from '../../models/BuildArtifact';
export type { Artifact, ArtifactCreateInput, ArtifactQueryOptions } from '../../models/BuildArtifact';
export { createArtifact, recordArtifactDownload } from '../../models/BuildArtifact';

// Re-import for internal use
import {
  ArtifactType,
  ArtifactStorageType,
  Artifact,
  ArtifactCreateInput,
  ArtifactQueryOptions,
  createArtifact,
  recordArtifactDownload,
} from '../../models/BuildArtifact';
import { v4 as uuidv4 } from 'uuid';

/**
 * Artifact 服务类
 *
 * 使用 BuildArtifactRepository 进行 PostgreSQL 持久化。
 * 支持多架构构建产物管理。
 */
export class ArtifactService {
  private readonly repository: BuildArtifactRepository;

  constructor(repository: BuildArtifactRepository) {
    if (!repository) {
      throw new Error('BuildArtifactRepository is required for ArtifactService');
    }
    this.repository = repository;
  }

  /**
   * 创建 Artifact
   */
  async createArtifact(input: ArtifactCreateInput): Promise<Artifact> {
    // 需要 tenantId，从 metadata 中获取或使用默认值
    const tenantId = (input.metadata as any)?.tenantId || '00000000-0000-0000-0000-000000000000';
    return this.repository.createArtifact({ ...input, tenantId });
  }

  /**
   * 创建多架构 Artifact（包含架构信息）
   */
  async createMultiArchArtifact(input: MultiArchArtifactCreateInput): Promise<Artifact> {
    const artifactInput: ArtifactCreateInput = {
      ...input,
      metadata: {
        ...input.metadata,
        architecture: input.architecture || 'amd64',
        isMultiArchManifest: input.isMultiArchManifest,
        manifestId: input.manifestId,
        manifestArchitectures: input.manifestArchitectures,
      },
    };
    return this.createArtifact(artifactInput);
  }

  /**
   * 并行执行多架构构建
   *
   * 为每个目标架构创建构建任务，支持并行执行。
   * 每个架构的构建结果独立记录，最终汇总为多架构构建结果。
   */
  async buildMultiArch(
    baseInput: Omit<ArtifactCreateInput, 'name'>,
    config: MultiArchBuildConfig
  ): Promise<MultiArchBuildResult> {
    const buildId = uuidv4();
    const startTime = Date.now();
    const results: ArchBuildResult[] = [];
    const architectures = config.architectures.length > 0 ? config.architectures : DEFAULT_ARCHITECTURES;
    const maxConcurrency = config.maxConcurrency || architectures.length;

    const runBuild = async (arch: BuildArchitecture): Promise<ArchBuildResult> => {
      const archStartTime = Date.now();
      try {
        const archBuildArgs = config.archBuildArgs?.[arch];
        const artifactInput: MultiArchArtifactCreateInput = {
          ...baseInput,
          name: `${(baseInput as any).name || 'artifact'}-${arch}`,
          architecture: arch,
          isMultiArchManifest: false,
          manifestId: buildId,
          manifestArchitectures: architectures,
          metadata: {
            ...baseInput.metadata,
            architecture: arch,
            buildArgs: archBuildArgs,
            buildId,
            crossCompile: config.crossCompile,
          },
        };

        const artifact = await this.createMultiArchArtifact(artifactInput);

        return {
          architecture: arch,
          success: true,
          artifactId: artifact.id,
          durationMs: Date.now() - archStartTime,
          fileSize: artifact.size,
          checksum: artifact.checksum,
        };
      } catch (error) {
        return {
          architecture: arch,
          success: false,
          artifactId: '',
          durationMs: Date.now() - archStartTime,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    // Execute builds with controlled concurrency
    if (config.parallel && maxConcurrency > 1) {
      // Parallel execution with concurrency limit
      const batches: BuildArchitecture[][] = [];
      for (let i = 0; i < architectures.length; i += maxConcurrency) {
        batches.push(architectures.slice(i, i + maxConcurrency));
      }

      for (const batch of batches) {
        const batchResults = await Promise.all(batch.map(runBuild));
        results.push(...batchResults);
      }
    } else {
      // Sequential execution
      for (const arch of architectures) {
        const result = await runBuild(arch);
        results.push(result);
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    // If all architectures built successfully, create a manifest artifact
    if (successCount === architectures.length) {
      const manifestInput: MultiArchArtifactCreateInput = {
        ...baseInput,
        name: `${(baseInput as any).name || 'artifact'}-manifest`,
        isMultiArchManifest: true,
        manifestId: buildId,
        manifestArchitectures: architectures,
        size: results.reduce((sum, r) => sum + (r.fileSize || 0), 0),
        metadata: {
          ...baseInput.metadata,
          architectures,
          buildId,
          totalDurationMs,
        },
      };
      try {
        await this.createMultiArchArtifact(manifestInput);
      } catch {
        // Manifest creation failure doesn't fail the build
      }
    }

    return {
      buildId,
      results,
      totalDurationMs,
      successCount,
      failureCount: architectures.length - successCount,
      allSuccessful: successCount === architectures.length,
    };
  }

  /**
   * 获取 Artifact
   */
  async getArtifact(id: string): Promise<Artifact | null> {
    const result = await this.repository.findById(id);
    return result || null;
  }

  /**
   * 查询 Artifact 列表
   */
  async listArtifacts(options?: ArtifactQueryOptions): Promise<Artifact[]> {
    const result = await this.repository.findAll(options);
    return result.entities;
  }

  /**
   * 记录下载
   */
  async recordDownload(id: string): Promise<Artifact | null> {
    const result = await this.repository.recordDownload(id);
    return result || null;
  }

  /**
   * 删除 Artifact
   */
  async deleteArtifact(id: string): Promise<boolean> {
    return this.repository.deleteArtifact(id);
  }

  /**
   * 清理过期的 Artifact
   */
  async cleanupExpired(): Promise<number> {
    return this.repository.cleanupExpired();
  }

  /**
   * 按 Run 清理 Artifact
   */
  async cleanupByRun(runId: string): Promise<number> {
    return this.repository.cleanupByRun(runId);
  }
}
