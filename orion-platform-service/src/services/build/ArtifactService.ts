/**
 * Artifact Service - 构建产物管理服务
 *
 * 职责：
 * - Artifact 上传和下载
 * - Artifact 存储管理
 * - Artifact 过期清理
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Artifact 类型
 */
export enum ArtifactType {
  BUILD_OUTPUT = 'build-output',      // 构建输出
  TEST_RESULT = 'test-result',        // 测试结果
  COVERAGE_REPORT = 'coverage-report', // 覆盖率报告
  LOG_FILE = 'log-file',              // 日志文件
  OTHER = 'other',                    // 其他
}

/**
 * Artifact 存储类型
 */
export enum ArtifactStorageType {
  LOCAL = 'local',        // 本地存储
  S3 = 's3',             // S3 兼容存储
}

/**
 * Artifact 元数据
 */
export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  storageType: ArtifactStorageType;
  storagePath: string;
  size: number;           // 文件大小（字节）
  checksum?: string;      // 文件校验和
  runId: string;          // 关联的 PipelineRun ID
  stageId?: string;       // 关联的 Stage ID
  expiresAt?: Date;       // 过期时间
  downloadedCount: number; // 下载次数
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建 Artifact 输入
 */
export interface ArtifactCreateInput {
  name: string;
  type?: ArtifactType;
  storageType?: ArtifactStorageType;
  storagePath: string;
  size: number;
  checksum?: string;
  runId: string;
  stageId?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Artifact 查询选项
 */
export interface ArtifactQueryOptions {
  runId?: string;
  stageId?: string;
  type?: ArtifactType;
  limit?: number;
  offset?: number;
}

/**
 * 创建 Artifact
 */
export function createArtifact(input: ArtifactCreateInput): Artifact {
  const now = new Date();
  return {
    id: uuidv4(),
    name: input.name,
    type: input.type || ArtifactType.OTHER,
    storageType: input.storageType || ArtifactStorageType.LOCAL,
    storagePath: input.storagePath,
    size: input.size,
    checksum: input.checksum,
    runId: input.runId,
    stageId: input.stageId,
    expiresAt: input.expiresAt,
    downloadedCount: 0,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 记录 Artifact 下载
 */
export function recordArtifactDownload(artifact: Artifact): Artifact {
  return {
    ...artifact,
    downloadedCount: artifact.downloadedCount + 1,
    updatedAt: new Date(),
  };
}

/**
 * Artifact 服务类
 */
export class ArtifactService {
  private artifacts: Map<string, Artifact>;

  constructor() {
    this.artifacts = new Map();
  }

  /**
   * 创建 Artifact
   */
  async createArtifact(input: ArtifactCreateInput): Promise<Artifact> {
    const artifact = createArtifact(input);
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  /**
   * 获取 Artifact
   */
  async getArtifact(id: string): Promise<Artifact | null> {
    return this.artifacts.get(id) || null;
  }

  /**
   * 查询 Artifact 列表
   */
  async listArtifacts(options?: ArtifactQueryOptions): Promise<Artifact[]> {
    let result = Array.from(this.artifacts.values());

    // 按 runId 过滤
    if (options?.runId) {
      result = result.filter(a => a.runId === options.runId);
    }

    // 按 stageId 过滤
    if (options?.stageId) {
      result = result.filter(a => a.stageId === options.stageId);
    }

    // 按类型过滤
    if (options?.type) {
      result = result.filter(a => a.type === options.type);
    }

    // 按过期时间过滤（只返回未过期的）
    const now = new Date();
    result = result.filter(a => !a.expiresAt || a.expiresAt > now);

    // 排序（最新的在前）
    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 分页
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return result.slice(offset, offset + limit);
  }

  /**
   * 记录下载
   */
  async recordDownload(id: string): Promise<Artifact | null> {
    const artifact = this.artifacts.get(id);
    if (!artifact) return null;

    const updated = recordArtifactDownload(artifact);
    this.artifacts.set(id, updated);
    return updated;
  }

  /**
   * 删除 Artifact
   */
  async deleteArtifact(id: string): Promise<boolean> {
    return this.artifacts.delete(id);
  }

  /**
   * 清理过期的 Artifact
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let count = 0;

    for (const [id, artifact] of this.artifacts.entries()) {
      if (artifact.expiresAt && artifact.expiresAt <= now) {
        this.artifacts.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * 按 Run 清理 Artifact
   */
  async cleanupByRun(runId: string): Promise<number> {
    let count = 0;
    for (const [id, artifact] of this.artifacts.entries()) {
      if (artifact.runId === runId) {
        this.artifacts.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const artifactService = new ArtifactService();
