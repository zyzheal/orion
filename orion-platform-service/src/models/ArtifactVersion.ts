/**
 * ArtifactVersion — 制品版本溯源数据模型
 *
 * 用于追踪从代码提交 -> 构建运行 -> 制品产出 -> 部署的完整追溯链。
 * GAP-CN-06: 制品版本化管理与溯源能力
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * ArtifactVersion 核心接口
 * 每条记录代表一次 PipelineRun 产出的制品版本
 */
export interface ArtifactVersion {
  id: string;
  tenantId: string;
  pipelineId: string;
  runId: string;
  stageName: string;
  artifactName: string;
  version: string;           // 语义化版本号或构建编号 (e.g., "1.2.3", "build-456")
  commitSha?: string;        // 产生该制品的源代码提交 SHA
  branch?: string;           // 源代码分支
  metadata: Record<string, string>;  // 附加元数据 (image tag, file hash 等)
  storagePath: string;       // 制品文件存储路径
  createdAt: Date;
}

/**
 * 创建 ArtifactVersion 的输入参数
 */
export interface ArtifactVersionCreateInput {
  tenantId: string;
  pipelineId: string;
  runId: string;
  stageName: string;
  artifactName: string;
  version: string;
  commitSha?: string;
  branch?: string;
  metadata?: Record<string, string>;
  storagePath: string;
}

/**
 * 追溯链：从制品回溯到源代码的完整链路
 */
export interface TraceabilityChain {
  version: ArtifactVersion;
  pipelineRun?: {
    id: string;
    pipelineId: string;
    triggerType: string;
    status: string;
    startedAt?: Date;
    completedAt?: Date;
    context?: Record<string, unknown>;
  };
  deployments?: Array<{
    id: string;
    environment: string;
    status: string;
    deployedAt: Date;
    deployedBy?: string;
  }>;
}

/**
 * 部署历史：某 Pipeline 的所有版本部署记录
 */
export interface DeploymentHistory {
  pipelineId: string;
  versions: Array<{
    version: string;
    commitSha?: string;
    branch?: string;
    createdAt: Date;
    deployments: Array<{
      environment: string;
      status: string;
      deployedAt: Date;
      deployedBy?: string;
    }>;
  }>;
}

/**
 * 版本差异：两个版本之间的变更对比
 */
export interface VersionDiff {
  pipelineId: string;
  versionA: string;
  versionB: string;
  changes: {
    commitDiff?: { from?: string; to?: string };
    branchDiff?: { from?: string; to?: string };
    metadataAdded: string[];
    metadataRemoved: string[];
    metadataChanged: Array<{ key: string; oldValue: string; newValue: string }>;
  };
}

/**
 * 查询选项
 */
export interface ArtifactVersionQueryOptions {
  tenantId?: string;
  pipelineId?: string;
  runId?: string;
  commitSha?: string;
  branch?: string;
  version?: string;
  artifactName?: string;
  limit?: number;
  offset?: number;
}

/**
 * 工具函数：创建 ArtifactVersion 实例（不持久化）
 */
export function createArtifactVersion(input: ArtifactVersionCreateInput): ArtifactVersion {
  return {
    id: uuidv4(),
    tenantId: input.tenantId,
    pipelineId: input.pipelineId,
    runId: input.runId,
    stageName: input.stageName,
    artifactName: input.artifactName,
    version: input.version,
    commitSha: input.commitSha,
    branch: input.branch,
    metadata: input.metadata || {},
    storagePath: input.storagePath,
    createdAt: new Date(),
  };
}
