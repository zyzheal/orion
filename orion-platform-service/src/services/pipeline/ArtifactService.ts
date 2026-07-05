/**
 * ArtifactService - Stage 间 Artifact 传递服务
 *
 * 负责：
 * - 存储 Stage 执行产出的 artifact（文件/数据）
 * - 检索 artifact 供下游 Stage 使用
 * - 按 run 管理 artifact 生命周期
 * - 将 artifact 从上游 Stage 传递给下游 Stage
 *
 * 存储方式：文件系统 + PostgreSQL 元数据索引
 * 文件系统：默认 /tmp/orion-artifacts
 * 元数据：artifact_records 表（ArtifactRecordRepository）
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../utils/logger';
import { ArtifactVersionRepository } from '../../repositories/ArtifactVersionRepository';
import { ArtifactRecordRepository } from '../../repositories/ArtifactRecordRepository';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('ArtifactService');

export interface ArtifactMetadata {
  name: string;
  runId: string;
  stageId: string;
  size: number;
  mimeType?: string;
  createdAt: Date;
  uploadedBy?: string;
  description?: string;
}

export interface ArtifactRecord extends ArtifactMetadata {
  filePath: string;
}

export interface UploadInput {
  runId: string;
  stageId: string;
  name: string;
  data: Buffer | string;
  mimeType?: string;
  uploadedBy?: string;
  description?: string;
  // Version tracking fields (GAP-CN-06)
  pipelineId?: string;
  version?: string;
  commitSha?: string;
  branch?: string;
}

/**
 * ArtifactService 构造函数选项
 */
export interface ArtifactServiceOptions {
  baseDir?: string;
  maxAgeHours?: number;
  versionRepository?: ArtifactVersionRepository;
  /** PostgreSQL database connection for artifact record persistence */
  db?: { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }> };
  tenantId?: string;
}

export class ArtifactService {
  private baseDir: string;
  private cleanupInterval?: NodeJS.Timeout;
  private maxAgeMs: number;
  // 可选的版本追踪仓库（GAP-CN-06）
  private versionRepository?: ArtifactVersionRepository;
  // Artifact 记录持久化仓库
  private recordRepository: ArtifactRecordRepository | null = null;
  private tenantId: string;

  constructor(options?: ArtifactServiceOptions) {
    this.baseDir = options?.baseDir || process.env.ARTIFACT_BASE_DIR || '/tmp/orion-artifacts';
    this.maxAgeMs = (options?.maxAgeHours ?? 72) * 60 * 60 * 1000; // Default: 72 hours
    this.versionRepository = options?.versionRepository;
    this.tenantId = options?.tenantId || 'system';
    if (options?.db) {
      this.recordRepository = new ArtifactRecordRepository(options.db);
    }
    this.ensureBaseDir();
    this.startCleanupInterval();
  }

  /**
   * 上传 artifact
   *
   * 如果配置了 versionRepository 且上传输入中包含 pipelineId/version 信息，
   * 则自动记录制品版本追踪信息（GAP-CN-06）。
   */
  async upload(input: UploadInput): Promise<ArtifactRecord> {
    const stageDir = this.getStageDir(input.runId, input.stageId);
    this.ensureDir(stageDir);

    const filePath = path.join(stageDir, this.sanitizeFileName(input.name));
    const data = typeof input.data === 'string' ? Buffer.from(input.data) : input.data;

    fs.writeFileSync(filePath, data);

    const now = new Date();
    const record: ArtifactRecord = {
      name: input.name,
      runId: input.runId,
      stageId: input.stageId,
      size: data.length,
      mimeType: input.mimeType,
      createdAt: now,
      uploadedBy: input.uploadedBy,
      description: input.description,
      filePath,
    };

    // 持久化到 PostgreSQL
    if (this.recordRepository) {
      try {
        await this.recordRepository.createRecord({
          id: `${input.runId}:${input.stageId}:${input.name}`,
          tenantId: this.tenantId,
          runId: input.runId,
          stageId: input.stageId,
          name: input.name,
          size: data.length,
          mimeType: input.mimeType,
          filePath,
          uploadedBy: input.uploadedBy,
          description: input.description,
        });
      } catch (err) {
        logger.warn(
          { err, runId: input.runId, stageId: input.stageId, name: input.name },
          'Failed to persist artifact record to PostgreSQL (non-fatal)'
        );
      }
    }

    // GAP-CN-06: 如果配置了版本追踪仓库，记录版本信息
    if (this.versionRepository && input.pipelineId && input.version) {
      try {
        await this.versionRepository.createVersion({
          tenantId: this.tenantId,
          pipelineId: input.pipelineId,
          runId: input.runId,
          stageName: input.stageId,
          artifactName: input.name,
          version: input.version,
          commitSha: input.commitSha,
          branch: input.branch,
          metadata: {
            size: String(data.length),
            ...(input.mimeType ? { mimeType: input.mimeType } : {}),
          },
          storagePath: filePath,
        });
        logger.info(
          { runId: input.runId, pipelineId: input.pipelineId, version: input.version },
          'Artifact version tracked'
        );
      } catch (err) {
        // 版本记录失败不影响主流程（优雅降级）
        logger.warn(
          { err, runId: input.runId, pipelineId: input.pipelineId },
          'Failed to record artifact version (non-fatal)'
        );
      }
    }

    logger.info(
      { runId: input.runId, stageId: input.stageId, name: input.name, size: data.length },
      'Artifact uploaded'
    );

    return record;
  }

  /**
   * 下载 artifact
   */
  async download(runId: string, stageId: string, name: string): Promise<Buffer | null> {
    const record = await this.findRecord(runId, stageId, name);
    if (!record || !fs.existsSync(record.filePath)) {
      return null;
    }
    return fs.readFileSync(record.filePath);
  }

  /**
   * 下载 artifact 为字符串
   */
  async downloadText(runId: string, stageId: string, name: string): Promise<string | null> {
    const buf = await this.download(runId, stageId, name);
    return buf ? buf.toString() : null;
  }

  /**
   * 列出某个 run 的所有 artifact
   */
  async listByRun(runId: string): Promise<ArtifactRecord[]> {
    if (this.recordRepository) {
      try {
        const entities = await this.recordRepository.findByRunId(runId);
        return entities.map(e => this.entityToRecord(e));
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err, runId }, 'Failed to list artifacts from PostgreSQL');
      }
    }

    // Fallback: scan filesystem (for environments without DB)
    const runDir = this.getRunDir(runId);
    if (!fs.existsSync(runDir)) return [];

    const results: ArtifactRecord[] = [];
    const stageDirs = fs.readdirSync(runDir, { withFileTypes: true });
    for (const stageEntry of stageDirs) {
      if (stageEntry.isDirectory()) {
        const stagePath = path.join(runDir, stageEntry.name);
        const files = fs.readdirSync(stagePath);
        for (const file of files) {
          const filePath = path.join(stagePath, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            results.push({
              name: file,
              runId,
              stageId: stageEntry.name,
              size: stats.size,
              createdAt: stats.birthtime || stats.mtime,
              filePath,
            });
          }
        }
      }
    }
    return results;
  }

  /**
   * 列出某个 stage 的所有 artifact
   */
  async listByStage(runId: string, stageId: string): Promise<ArtifactRecord[]> {
    if (this.recordRepository) {
      try {
        const entities = await this.recordRepository.findByStage(runId, stageId);
        return entities.map(e => this.entityToRecord(e));
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err, runId, stageId }, 'Failed to list stage artifacts from PostgreSQL');
      }
    }

    // Fallback: scan filesystem (for environments without DB)
    const stageDir = this.getStageDir(runId, stageId);
    if (!fs.existsSync(stageDir)) return [];

    const results: ArtifactRecord[] = [];
    const files = fs.readdirSync(stageDir);
    for (const file of files) {
      const filePath = path.join(stageDir, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        results.push({
          name: file,
          runId,
          stageId,
          size: stats.size,
          createdAt: stats.birthtime || stats.mtime,
          filePath,
        });
      }
    }
    return results;
  }

  /**
   * 获取 artifact 元数据
   */
  async getMetadata(runId: string, stageId: string, name: string): Promise<ArtifactMetadata | null> {
    const record = await this.findRecord(runId, stageId, name);
    if (!record) return null;
    const { filePath: _filePath, ...metadata } = record;
    return metadata;
  }

  /**
   * 将 artifact 从一个 stage 传递给另一个 stage
   * 创建符号链接或复制，使目标 stage 可以访问源 stage 的 artifact
   *
   * @param runId - Pipeline run ID
   * @param fromStageId - 源 stage ID
   * @param toStageId - 目标 stage ID
   * @param artifactNames - 要传递的 artifact 名称列表（空表示传递全部）
   */
  async passToStage(
    runId: string,
    fromStageId: string,
    toStageId: string,
    artifactNames?: string[]
  ): Promise<{ passed: number; errors: string[] }> {
    const sourceArtifacts = await this.listByStage(runId, fromStageId);
    const namesToPass = artifactNames && artifactNames.length > 0
      ? sourceArtifacts.filter(a => artifactNames.includes(a.name))
      : sourceArtifacts;

    const passed: ArtifactRecord[] = [];
    const errors: string[] = [];

    for (const artifact of namesToPass) {
      try {
        const data = await this.download(runId, fromStageId, artifact.name);
        if (!data) {
          errors.push(`Artifact ${artifact.name} not found on disk`);
          continue;
        }

        // 写入目标 stage 目录
        const targetDir = this.getStageDir(runId, toStageId);
        this.ensureDir(targetDir);
        const targetPath = path.join(targetDir, `from-${fromStageId}-${this.sanitizeFileName(artifact.name)}`);
        fs.writeFileSync(targetPath, data);

        // 持久化到 PostgreSQL
        const passedRecord: ArtifactRecord = {
          name: artifact.name,
          runId,
          stageId: toStageId,
          size: data.length,
          mimeType: artifact.mimeType,
          createdAt: new Date(),
          uploadedBy: `passed-from-${fromStageId}`,
          description: `Passed from stage ${fromStageId}`,
          filePath: targetPath,
        };

        if (this.recordRepository) {
          try {
            await this.recordRepository.createRecord({
              id: `${runId}:${toStageId}:${artifact.name}`,
              tenantId: this.tenantId,
              runId,
              stageId: toStageId,
              name: artifact.name,
              size: data.length,
              mimeType: artifact.mimeType,
              filePath: targetPath,
              uploadedBy: `passed-from-${fromStageId}`,
              description: `Passed from stage ${fromStageId}`,
            });
          } catch (err) {
            logger.warn({ traceId: getCurrentTraceId(), err, runId, toStageId }, 'Failed to persist passed artifact record');
          }
        }

        passed.push(passedRecord);
      } catch (err) {
        errors.push(`Failed to pass ${artifact.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logger.info(
      { runId, fromStageId, toStageId, passed: passed.length, errors: errors.length },
      'Artifacts passed between stages'
    );

    return { passed: passed.length, errors };
  }

  /**
   * 获取某个 stage 可用的所有 artifacts（包括上游传递的）
   */
  async getAvailableArtifacts(runId: string, stageId: string): Promise<ArtifactRecord[]> {
    return this.listByStage(runId, stageId);
  }

  /**
   * 清理某个 run 的所有 artifacts
   */
  async cleanupRun(runId: string): Promise<void> {
    const runDir = this.getRunDir(runId);
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
    // 从 PostgreSQL 删除
    if (this.recordRepository) {
      try {
        await this.recordRepository.deleteByRunId(runId);
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err, runId }, 'Failed to delete artifact records from PostgreSQL');
      }
    }
    logger.info({ runId }, 'Artifact run cleaned up');
  }

  /**
   * 获取 artifact 的磁盘路径（供外部直接读取）
   */
  async getArtifactPath(runId: string, stageId: string, name: string): Promise<string | null> {
    const record = await this.findRecord(runId, stageId, name);
    return record ? record.filePath : null;
  }

  /**
   * 获取 stage 的工作目录（所有 artifacts 存放处）
   */
  getStageDir(runId: string, stageId: string): string {
    return path.join(this.baseDir, runId, stageId);
  }

  /**
   * 关闭 artifact 服务（清理定时器）
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * 清理过期的 artifact 记录
   */
  private async cleanupExpiredArtifacts(): Promise<void> {
    if (this.recordRepository) {
      try {
        const deleted = await this.recordRepository.deleteExpired(this.maxAgeMs);
        if (deleted > 0) {
          logger.info({ removed: deleted }, 'Cleaned up expired artifact records from PostgreSQL');
        }
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err }, 'Failed to cleanup expired artifacts from PostgreSQL');
      }
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredArtifacts();
    }, 60 * 60 * 1000); // Every hour
    this.cleanupInterval.unref();
  }

  // ==================== Internal Helpers ====================

  private getRunDir(runId: string): string {
    return path.join(this.baseDir, runId);
  }

  private ensureBaseDir(): void {
    this.ensureDir(this.baseDir);
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * 从 PostgreSQL 查找单个 artifact 记录
   * 如果没有配置 repository，回退到文件系统检查
   */
  private async findRecord(runId: string, stageId: string, name: string): Promise<ArtifactRecord | null> {
    if (this.recordRepository) {
      try {
        const entity = await this.recordRepository.findByName(runId, stageId, name);
        if (entity) {
          return this.entityToRecord(entity);
        }
      } catch (err) {
        logger.warn({ traceId: getCurrentTraceId(), err, runId, stageId, name }, 'Failed to find artifact in PostgreSQL');
      }
    }

    // Fallback: check filesystem directly (for environments without DB)
    const stageDir = this.getStageDir(runId, stageId);
    const sanitizedPath = path.join(stageDir, this.sanitizeFileName(name));
    if (fs.existsSync(sanitizedPath)) {
      const stats = fs.statSync(sanitizedPath);
      return {
        name,
        runId,
        stageId,
        size: stats.size,
        createdAt: stats.birthtime || stats.mtime,
        filePath: sanitizedPath,
      };
    }

    return null;
  }

  /**
   * 将数据库实体转换为 ArtifactRecord
   */
  private entityToRecord(entity: any): ArtifactRecord {
    return {
      name: entity.name,
      runId: entity.runId,
      stageId: entity.stageId,
      size: entity.size,
      mimeType: entity.mimeType,
      createdAt: entity.createdAt,
      uploadedBy: entity.uploadedBy,
      description: entity.description,
      filePath: entity.filePath,
    };
  }
}
