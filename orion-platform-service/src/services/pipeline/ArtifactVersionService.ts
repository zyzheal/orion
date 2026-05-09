/**
 * ArtifactVersionService — 制品版本管理服务
 *
 * 职责：
 * - 版本创建与查询
 * - 版本晋升（promote: dev → staging → prod）
 * - 版本标签管理（tag/untag）
 * - 版本溯源（lineage：祖先/后代）
 * - 循环引用保护（BFS 遍历检测）
 */

import pino from 'pino';
import { ArtifactVersionRepository } from '../repositories/ArtifactVersionRepository';
import { ArtifactVersion, ArtifactVersionCreateInput } from '../models/ArtifactVersion';

const logger = pino({ name: 'artifact-version-service' });

export interface VersionLineageResult {
  version: ArtifactVersion;
  ancestors: ArtifactVersion[];
  descendants: string[];
}

export interface VersionPromoteInput {
  versionId: string;
  targetEnvironment: string;
}

export class ArtifactVersionService {
  private repository: ArtifactVersionRepository;
  private maxLineageDepth = 50;

  constructor(repository: ArtifactVersionRepository) {
    this.repository = repository;
  }

  /**
   * 创建制品版本
   */
  async createVersion(input: ArtifactVersionCreateInput): Promise<ArtifactVersion> {
    // 检查是否已存在同名同版本
    const existing = await this.repository.findByVersion(input.pipelineId, input.version);
    if (existing) {
      throw new Error(
        `Version ${input.version} already exists for pipeline ${input.pipelineId}`
      );
    }

    const version = await this.repository.createVersion(input);
    logger.info(
      { artifactName: input.artifactName, version: input.version },
      'Artifact version created'
    );

    return version;
  }

  /**
   * 晋升版本到指定环境
   *
   * 循环引用保护：检查目标版本是否在晋升链的后代中
   */
  async promoteVersion(
    fromVersionId: string,
    targetEnvironment: string
  ): Promise<ArtifactVersion> {
    // 获取当前版本
    const currentVersion = await this.repository.findById(fromVersionId);
    if (!currentVersion) {
      throw new Error(`Version not found: ${fromVersionId}`);
    }

    // 循环引用保护：检查 promoted_from 链
    const descendants = await this.repository.getDescendants(
      fromVersionId,
      this.maxLineageDepth
    );

    // 如果要晋升的版本在后代中，说明会产生循环
    if (descendants.includes(fromVersionId)) {
      throw new Error(
        `Cannot promote version: would create circular reference. ` +
        `Version ${fromVersionId} is already in the promotion chain.`
      );
    }

    // 创建新版本（继承原版本信息，更新环境）
    const newVersion = await this.repository.createVersion({
      tenantId: currentVersion.tenantId,
      pipelineId: currentVersion.pipelineId,
      runId: currentVersion.runId,
      stageName: currentVersion.stageName,
      artifactName: currentVersion.artifactName,
      version: currentVersion.version,
      commitSha: currentVersion.commitSha,
      branch: currentVersion.branch,
      metadata: {
        ...currentVersion.metadata,
        promotedTo: targetEnvironment,
        promotedAt: new Date().toISOString(),
        previousEnvironment: currentVersion.metadata.promotedTo || 'dev',
      },
      storagePath: currentVersion.storagePath,
    });

    logger.info(
      {
        fromVersion: fromVersionId,
        toVersion: newVersion.id,
        targetEnvironment,
      },
      'Version promoted'
    );

    return newVersion;
  }

  /**
   * 获取版本溯源信息（祖先 + 后代）
   */
  async getVersionLineage(versionId: string): Promise<VersionLineageResult> {
    const version = await this.repository.findById(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const ancestors = await this.repository.getAncestors(versionId, this.maxLineageDepth);
    const descendants = await this.repository.getDescendants(versionId, this.maxLineageDepth);

    return { version, ancestors, descendants };
  }

  /**
   * 添加标签
   */
  async addTag(versionId: string, tag: string): Promise<ArtifactVersion> {
    const version = await this.repository.findById(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    await this.repository.addTag(versionId, tag);
    logger.info({ versionId, tag }, 'Tag added to version');

    return { ...version, tags: [...(version.tags || []), tag] };
  }

  /**
   * 移除标签
   */
  async removeTag(versionId: string, tag: string): Promise<void> {
    await this.repository.removeTag(versionId, tag);
    logger.info({ versionId, tag }, 'Tag removed from version');
  }

  /**
   * 按标签查询版本
   */
  async findVersionsByTag(tag: string): Promise<ArtifactVersion[]> {
    return this.repository.findByTag(tag);
  }

  /**
   * 获取部署历史
   */
  async getDeploymentHistory(pipelineId: string, limit = 20) {
    return this.repository.getDeploymentHistory(pipelineId, limit);
  }

  /**
   * 版本对比
   */
  async compareVersions(pipelineId: string, versionA: string, versionB: string) {
    return this.repository.getVersionDiff(pipelineId, versionA, versionB);
  }
}
