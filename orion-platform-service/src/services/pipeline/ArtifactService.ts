/**
 * ArtifactService - Stage 间 Artifact 传递服务
 *
 * 负责：
 * - 存储 Stage 执行产出的 artifact（文件/数据）
 * - 检索 artifact 供下游 Stage 使用
 * - 按 run 管理 artifact 生命周期
 * - 将 artifact 从上游 Stage 传递给下游 Stage
 *
 * 存储方式：文件系统，默认 /tmp/orion-artifacts
 */

import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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
}

export class ArtifactService {
  private baseDir: string;
  // 内存索引：runId -> stageId -> name -> ArtifactRecord
  private index = new Map<string, Map<string, Map<string, ArtifactRecord>>>();
  private cleanupInterval?: NodeJS.Timeout;
  private maxAgeMs: number;

  constructor(options?: { baseDir?: string; maxAgeHours?: number }) {
    this.baseDir = options?.baseDir || process.env.ARTIFACT_BASE_DIR || '/tmp/orion-artifacts';
    this.maxAgeMs = (options?.maxAgeHours ?? 72) * 60 * 60 * 1000; // Default: 72 hours
    this.ensureBaseDir();
    this.startCleanupInterval();
  }

  /**
   * 上传 artifact
   */
  async upload(input: UploadInput): Promise<ArtifactRecord> {
    const stageDir = this.getStageDir(input.runId, input.stageId);
    this.ensureDir(stageDir);

    const filePath = path.join(stageDir, this.sanitizeFileName(input.name));
    const data = typeof input.data === 'string' ? Buffer.from(input.data) : input.data;

    fs.writeFileSync(filePath, data);

    const record: ArtifactRecord = {
      name: input.name,
      runId: input.runId,
      stageId: input.stageId,
      size: data.length,
      mimeType: input.mimeType,
      createdAt: new Date(),
      uploadedBy: input.uploadedBy,
      description: input.description,
      filePath,
    };

    // 更新索引
    this.addToIndex(record);

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
    const record = this.findInIndex(runId, stageId, name);
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
  listByRun(runId: string): ArtifactRecord[] {
    const runIndex = this.index.get(runId);
    if (!runIndex) return [];

    const results: ArtifactRecord[] = [];
    for (const stageMap of runIndex.values()) {
      for (const record of stageMap.values()) {
        results.push(record);
      }
    }
    return results;
  }

  /**
   * 列出某个 stage 的所有 artifact
   */
  listByStage(runId: string, stageId: string): ArtifactRecord[] {
    const runIndex = this.index.get(runId);
    if (!runIndex) return [];
    const stageMap = runIndex.get(stageId);
    if (!stageMap) return [];
    return Array.from(stageMap.values());
  }

  /**
   * 获取 artifact 元数据
   */
  getMetadata(runId: string, stageId: string, name: string): ArtifactMetadata | null {
    const record = this.findInIndex(runId, stageId, name);
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
    const sourceArtifacts = this.listByStage(runId, fromStageId);
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

        // 添加到目标 stage 的索引
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
        this.addToIndex(passedRecord);
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
  getAvailableArtifacts(runId: string, stageId: string): ArtifactRecord[] {
    return this.listByStage(runId, stageId);
  }

  /**
   * 清理某个 run 的所有 artifacts
   */
  cleanupRun(runId: string): void {
    const runDir = this.getRunDir(runId);
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
    this.index.delete(runId);
    logger.info({ runId }, 'Artifact run cleaned up');
  }

  /**
   * 获取 artifact 的磁盘路径（供外部直接读取）
   */
  getArtifactPath(runId: string, stageId: string, name: string): string | null {
    const record = this.findInIndex(runId, stageId, name);
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
  private cleanupExpiredArtifacts(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [runId, runIndex] of this.index.entries()) {
      let hasExpired = false;
      for (const stageMap of runIndex.values()) {
        for (const record of stageMap.values()) {
          if (now - record.createdAt.getTime() > this.maxAgeMs) {
            hasExpired = true;
            break;
          }
        }
        if (hasExpired) break;
      }
      if (hasExpired) {
        toDelete.push(runId);
      }
    }

    for (const runId of toDelete) {
      this.cleanupRun(runId);
    }

    if (toDelete.length > 0) {
      logger.info({ removed: toDelete.length }, 'Cleaned up expired artifact runs');
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

  private addToIndex(record: ArtifactRecord): void {
    let runIndex = this.index.get(record.runId);
    if (!runIndex) {
      runIndex = new Map();
      this.index.set(record.runId, runIndex);
    }
    let stageMap = runIndex.get(record.stageId);
    if (!stageMap) {
      stageMap = new Map();
      runIndex.set(record.stageId, stageMap);
    }
    stageMap.set(record.name, record);
  }

  private findInIndex(runId: string, stageId: string, name: string): ArtifactRecord | null {
    const runIndex = this.index.get(runId);
    if (!runIndex) return null;
    const stageMap = runIndex.get(stageId);
    if (!stageMap) return null;
    return stageMap.get(name) ?? null;
  }
}
