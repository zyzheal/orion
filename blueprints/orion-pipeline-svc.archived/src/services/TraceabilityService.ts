/**
 * TraceabilityService — 制品版本溯源业务逻辑层
 *
 * GAP-CN-06: 提供从代码提交 -> 构建运行 -> 制品产出 -> 部署上线的完整追溯链查询。
 * 通过 ArtifactVersionRepository 实现，添加业务逻辑层校验和错误处理。
 *
 * 核心能力:
 * - getTraceabilityChain(versionId): 从制品版本回溯到源代码和部署记录
 * - getDeploymentHistory(pipelineId): 某个 Pipeline 的所有版本和部署历史
 * - getVersionDiff(pipelineId, versionA, versionB): 两个版本之间的差异对比
 * - recordVersion(input): 记录新的制品版本
 */

import {
  ArtifactVersionRepository,
} from '../repositories/ArtifactVersionRepository';
import type {
  ArtifactVersion,
  ArtifactVersionCreateInput,
  ArtifactVersionQueryOptions,
  TraceabilityChain,
  DeploymentHistory,
  VersionDiff,
} from '../models/ArtifactVersion';

export class TraceabilityServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TraceabilityServiceError';
  }
}

export interface SearchResult {
  versions: ArtifactVersion[];
  total: number;
}

export class TraceabilityService {
  constructor(private repository: ArtifactVersionRepository) {}

  /**
   * 记录新的制品版本
   *
   * 当 PipelineRun 产出制品时调用，将版本信息持久化到数据库。
   * 包含 commit SHA 和 branch 信息以支持代码溯源。
   */
  async recordVersion(input: ArtifactVersionCreateInput): Promise<ArtifactVersion> {
    return this.repository.createVersion(input);
  }

  /**
   * 获取完整追溯链
   *
   * 从某个制品版本 ID 出发，回溯到：
   * 1. 制品版本信息（版本号、commit SHA、branch）
   * 2. 关联的 PipelineRun（触发方式、执行状态、时间）
   * 3. 关联的部署记录（部署到哪些环境、状态、时间）
   *
   * @throws {TraceabilityServiceError} 如果找不到对应的版本记录
   */
  async getTraceabilityChain(versionId: string): Promise<TraceabilityChain> {
    const chain = await this.repository.findTraceabilityChain(versionId);
    if (!chain) {
      throw new TraceabilityServiceError(
        `Traceability chain not found: ${versionId}`,
        'NOT_FOUND',
      );
    }
    return chain;
  }

  /**
   * 获取某个 Pipeline 的部署历史
   *
   * 返回该 Pipeline 产出的所有制品版本及其在各环境的部署记录。
   * 适合用于发布看板、版本回滚决策等场景。
   *
   * @param pipelineId Pipeline ID
   * @param limit 返回版本数量上限，默认 20
   */
  async getDeploymentHistory(pipelineId: string, limit: number = 20): Promise<DeploymentHistory> {
    return this.repository.getDeploymentHistory(pipelineId, limit);
  }

  /**
   * 获取两个版本之间的差异
   *
   * 对比两个版本的 commit SHA、branch、metadata 等差异。
   * 适合用于变更分析、发布说明生成等场景。
   *
   * @throws {TraceabilityServiceError} 如果任一版本不存在
   */
  async getVersionDiff(
    pipelineId: string,
    versionA: string,
    versionB: string,
  ): Promise<VersionDiff> {
    const diff = await this.repository.getVersionDiff(pipelineId, versionA, versionB);
    if (!diff) {
      throw new TraceabilityServiceError(
        `Version diff not available: ${versionA} vs ${versionB}`,
        'NOT_FOUND',
      );
    }
    return diff;
  }

  /**
   * 根据 Run ID 查找制品版本
   *
   * 用于查看某次 Pipeline 运行产出的所有制品。
   */
  async findVersionsByRun(runId: string): Promise<ArtifactVersion[]> {
    return this.repository.findByRunId(runId);
  }

  /**
   * 根据 Pipeline ID 查找制品版本
   *
   * @param pipelineId Pipeline ID
   * @param limit 返回数量上限，默认 50
   */
  async findVersionsByPipeline(pipelineId: string, limit: number = 50): Promise<ArtifactVersion[]> {
    return this.repository.findByPipelineId(pipelineId, limit);
  }

  /**
   * 根据 Commit SHA 查找制品版本
   *
   * 用于代码溯源：某次提交产生了哪些制品。
   */
  async findVersionsByCommit(commitSha: string): Promise<ArtifactVersion[]> {
    return this.repository.findByCommitSha(commitSha);
  }

  /**
   * 获取某个 Pipeline 的最新制品版本
   *
   * 适合用于获取"当前最新版本"以进行快速部署。
   */
  async getLatestVersion(pipelineId: string): Promise<ArtifactVersion | undefined> {
    return this.repository.findLatestByPipeline(pipelineId);
  }

  /**
   * 高级查询：支持多条件组合搜索
   *
   * 支持按 tenantId、pipelineId、runId、commitSha、branch、version、artifactName
   * 等条件过滤，并支持分页。
   */
  async searchVersions(options: ArtifactVersionQueryOptions): Promise<SearchResult> {
    return this.repository.findWithFilters(options);
  }
}
