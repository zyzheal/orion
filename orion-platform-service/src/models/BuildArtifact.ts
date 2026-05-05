/**
 * Build Artifact Models
 *
 * 构建产物数据模型，供 ArtifactService 和 BuildArtifactRepository 共用。
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
 * 创建 Artifact（工具函数，不持久化）
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
 * 记录 Artifact 下载（工具函数，不持久化）
 */
export function recordArtifactDownload(artifact: Artifact): Artifact {
  return {
    ...artifact,
    downloadedCount: artifact.downloadedCount + 1,
    updatedAt: new Date(),
  };
}
