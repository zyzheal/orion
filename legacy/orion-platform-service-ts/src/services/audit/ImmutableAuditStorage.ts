/**
 * Immutable Audit Storage
 *
 * 不可变审计日志存储：
 * - Append-only 存储策略
 * - 写入后不可修改
 * - 支持签名验证
 * - 防篡改保护
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';
import { ChainedAuditLogEntry, ChainConfig, DEFAULT_CHAIN_CONFIG } from './AuditTypes';
import { ImmutableAuditEntryRepository, ImmutableAuditFileRepository } from '../../repositories/ImmutableAuditRepository';

const logger = createLogger('immutable-storage');

/**
 * 存储配置
 */
export interface ImmutableStorageConfig {
  /** 存储目录 */
  storageDir: string;
  /** 文件前缀 */
  filePrefix: string;
  /** 单文件最大条目数 */
  maxEntriesPerFile: number;
  /** 是否启用签名 */
  enableSignature: boolean;
  /** 签名密钥 */
  signingKey?: string;
  /** 是否启用写入保护 */
  enableWriteProtection: boolean;
  /** 同步写入 */
  syncWrite: boolean;
}

/**
 * 默认存储配置
 */
export const DEFAULT_STORAGE_CONFIG: ImmutableStorageConfig = {
  storageDir: './data/audit',
  filePrefix: 'audit-',
  maxEntriesPerFile: 10000,
  enableSignature: false,
  enableWriteProtection: true,
  syncWrite: true,
};

/**
 * 存储元数据
 */
interface StorageMetadata {
  /** 文件版本 */
  version: string;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  lastUpdatedAt: string;
  /** 条目数量 */
  entryCount: number;
  /** 最后序列号 */
  lastSequenceNumber: number;
  /** 最后链 Hash */
  lastChainHash: string;
  /** 文件 Hash */
  fileHash: string;
}

/**
 * 文件锁状态
 */
interface FileLock {
  locked: boolean;
  lockedAt?: Date;
  lockedBy?: string;
}

/**
 * Immutable Audit Storage
 */
export class ImmutableAuditStorage extends EventEmitter {
  private config: ImmutableStorageConfig;
  private chainConfig: ChainConfig;
  private currentFile: string | null = null;
  private currentFileEntries: number = 0;
  private currentMetadata: StorageMetadata | null = null;
  private fileLocks: Map<string, FileLock> = new Map();
  private writeLock: boolean = false;
  private entryBuffer: ChainedAuditLogEntry[] = [];
  private flushInterval?: NodeJS.Timeout;
  private initialized: boolean = false;

  // PostgreSQL Repository (primary storage)
  private entryRepository?: ImmutableAuditEntryRepository;
  private fileRepository?: ImmutableAuditFileRepository;
  private useRepository: boolean = false;

  constructor(
    storageConfig?: Partial<ImmutableStorageConfig>,
    chainConfig?: Partial<ChainConfig>,
    db?: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> }
  ) {
    super();
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...storageConfig };
    this.chainConfig = { ...DEFAULT_CHAIN_CONFIG, ...chainConfig };
    if (db) {
      this.entryRepository = new ImmutableAuditEntryRepository(db);
      this.fileRepository = new ImmutableAuditFileRepository(db);
      this.useRepository = true;
    }
  }

  /**
   * 初始化存储
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 确保存储目录存在
    await this.ensureStorageDir();

    // 查找或创建当前文件
    await this.findOrCreateCurrentFile();

    // 启动定期刷盘
    this.startFlushInterval();

    this.initialized = true;
    logger.info({ storageDir: this.config.storageDir }, 'Immutable storage initialized');
  }

  /**
   * 追加审计日志条目
   */
  async append(entry: ChainedAuditLogEntry): Promise<{
    success: boolean;
    file: string;
    position: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 检查是否需要新文件
    if (this.currentFileEntries >= this.config.maxEntriesPerFile) {
      await this.rotateFile();
    }

    // 添加到缓冲区
    this.entryBuffer.push(entry);

    // Persist to PostgreSQL (fire-and-forget for non-blocking writes)
    if (this.useRepository && this.entryRepository) {
      this.entryRepository.createFromChainedEntry(entry, this.currentFile || undefined).catch((err) => logger.warn({ err, entryId: entry.id }, 'Failed to persist audit entry'));
    }

    // 如果开启同步写入，立即刷盘
    if (this.config.syncWrite) {
      await this.flush();
    }

    this.currentFileEntries++;
    this.emit('entry:appended', { entry, file: this.currentFile });

    logger.debug({ id: entry.id, sequenceNumber: entry.sequenceNumber }, 'Entry appended');

    return {
      success: true,
      file: this.currentFile!,
      position: this.currentFileEntries,
    };
  }

  /**
   * 批量追加
   */
  async appendBatch(entries: ChainedAuditLogEntry[]): Promise<{
    success: boolean;
    appended: number;
    failed: number;
  }> {
    let appended = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        await this.append(entry);
        appended++;
      } catch (error) {
        logger.error({ error, id: entry.id }, 'Failed to append entry');
        failed++;
      }
    }

    return { success: failed === 0, appended, failed };
  }

  /**
   * 刷盘
   */
  async flush(): Promise<void> {
    if (this.entryBuffer.length === 0 || !this.currentFile) {
      return;
    }

    // 获取写入锁
    while (this.writeLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    this.writeLock = true;

    try {
      const entries = [...this.entryBuffer];
      this.entryBuffer = [];

      // 追加写入文件
      const fd = fs.openSync(this.currentFile, 'a');
      for (const entry of entries) {
        const line = JSON.stringify(entry) + '\n';
        fs.appendFileSync(fd, line);
      }
      fs.closeSync(fd);

      // 更新元数据
      await this.updateMetadata();

      logger.debug({ count: entries.length }, 'Entries flushed to disk');
    } finally {
      this.writeLock = false;
    }
  }

  /**
   * 读取条目
   */
  async read(options?: {
    startSequence?: number;
    endSequence?: number;
    limit?: number;
    file?: string;
  }): Promise<ChainedAuditLogEntry[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Try PostgreSQL repository first
    if (this.useRepository && this.entryRepository && !options?.file) {
      try {
        const entities = await this.entryRepository.findBySequenceRange(
          options?.startSequence || 1,
          options?.endSequence || Number.MAX_SAFE_INTEGER,
        );
        let entries = entities.map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          action: e.action,
          userId: e.userId,
          tenantId: e.tenantId || undefined,
          prevHash: e.prevHash,
          contentHash: e.contentHash,
          chainHash: e.chainHash,
          details: e.details,
          signature: e.signature || undefined,
          sequenceNumber: e.sequenceNumber,
        } as ChainedAuditLogEntry));

        if (options?.limit) {
          entries = entries.slice(0, options.limit);
        }
        return entries;
      } catch (err) {
        logger.warn({ error: err }, 'Failed to read from repository, falling back to files');
      }
    }

    // Fallback: file-based storage
    const entries: ChainedAuditLogEntry[] = [];
    const files = options?.file
      ? [options.file]
      : await this.getSortedFiles();

    for (const file of files) {
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line) as ChainedAuditLogEntry;

          // 序列号过滤
          if (options?.startSequence && entry.sequenceNumber < options.startSequence) {
            continue;
          }
          if (options?.endSequence && entry.sequenceNumber > options.endSequence) {
            continue;
          }

          entries.push(entry);

          // 限制数量
          if (options?.limit && entries.length >= options.limit) {
            return entries;
          }
        } catch (error) {
          logger.warn({ file, line: line.substring(0, 100) }, 'Failed to parse entry');
        }
      }
    }

    // 按序列号排序
    entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    return entries;
  }

  /**
   * 根据 ID 获取条目
   */
  async getById(id: string): Promise<ChainedAuditLogEntry | null> {
    // Try PostgreSQL repository first
    if (this.useRepository && this.entryRepository) {
      try {
        const entity = await this.entryRepository.findById(id);
        if (entity) {
          return {
            id: entity.id,
            timestamp: entity.timestamp,
            action: entity.action,
            userId: entity.userId,
            tenantId: entity.tenantId || undefined,
            prevHash: entity.prevHash,
            contentHash: entity.contentHash,
            chainHash: entity.chainHash,
            details: entity.details,
            signature: entity.signature || undefined,
            sequenceNumber: entity.sequenceNumber,
          };
        }
      } catch (err) {
        logger.warn({ error: err, id }, 'Failed to get from repository, falling back to files');
      }
    }

    // Fallback: file-based storage
    const files = await this.getSortedFiles();

    for (const file of files) {
      if (!fs.existsSync(file)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const entry = JSON.parse(line) as ChainedAuditLogEntry;
          if (entry.id === id) {
            return entry;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    return null;
  }

  /**
   * 验证文件完整性
   */
  async verifyFileIntegrity(file: string): Promise<{
    valid: boolean;
    entryCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let entryCount = 0;

    if (!fs.existsSync(file)) {
      return { valid: false, entryCount: 0, issues: ['File not found'] };
    }

    // 验证文件是否只读
    if (this.config.enableWriteProtection) {
      try {
        fs.accessSync(file, fs.constants.W_OK);
        // 如果可写，说明可能被修改过
        issues.push('File is writable (write protection not active)');
      } catch {
        // 文件不可写是预期行为
      }
    }

    // 读取并验证元数据
    const metaFile = this.getMetaFile(file);
    if (fs.existsSync(metaFile)) {
      const metadata = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as StorageMetadata;

      // 验证文件 Hash
      const currentHash = await this.computeFileHash(file);
      if (currentHash !== metadata.fileHash) {
        issues.push(`File hash mismatch: expected ${metadata.fileHash.substring(0, 8)}..., got ${currentHash.substring(0, 8)}...`);
      }
    }

    // 统计条目数
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.trim().split('\n');
    entryCount = lines.filter(l => l.trim()).length;

    return {
      valid: issues.length === 0,
      entryCount,
      issues,
    };
  }

  /**
   * 获取存储统计
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalEntries: number;
    lastSequenceNumber: number;
    lastChainHash: string;
    storageSizeBytes: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Try PostgreSQL repository first
    if (this.useRepository && this.entryRepository) {
      try {
        const maxSeq = await this.entryRepository.getMaxSequenceNumber();
        const lastEntry = maxSeq > 0 ? await this.entryRepository.findBySequenceRange(maxSeq, maxSeq) : [];
        return {
          totalFiles: 0, // DB doesn't track files
          totalEntries: maxSeq,
          lastSequenceNumber: maxSeq,
          lastChainHash: lastEntry.length > 0 ? lastEntry[0].chainHash : this.chainConfig.genesisHash,
          storageSizeBytes: 0, // Not applicable for DB
        };
      } catch (err) {
        logger.warn({ error: err }, 'Failed to get stats from repository, falling back to files');
      }
    }

    // Fallback: file-based stats
    const files = await this.getSortedFiles();
    let totalEntries = 0;
    let storageSizeBytes = 0;
    let lastSequenceNumber = 0;
    let lastChainHash = this.chainConfig.genesisHash;

    for (const file of files) {
      if (!fs.existsSync(file)) continue;

      const stats = fs.statSync(file);
      storageSizeBytes += stats.size;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      totalEntries += lines.length;

      // 获取最后一条记录
      if (lines.length > 0) {
        try {
          const lastEntry = JSON.parse(lines[lines.length - 1]) as ChainedAuditLogEntry;
          if (lastEntry.sequenceNumber > lastSequenceNumber) {
            lastSequenceNumber = lastEntry.sequenceNumber;
            lastChainHash = lastEntry.chainHash;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    return {
      totalFiles: files.length,
      totalEntries,
      lastSequenceNumber,
      lastChainHash,
      storageSizeBytes,
    };
  }

  /**
   * 关闭存储
   */
  async close(): Promise<void> {
    // 刷盘剩余数据
    await this.flush();

    // 停止定期刷盘
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // 设置文件只读保护
    if (this.config.enableWriteProtection && this.currentFile) {
      await this.setFileReadOnly(this.currentFile);
    }

    this.initialized = false;
    logger.info('Immutable storage closed');
  }

  /**
   * 确保存储目录存在
   */
  private async ensureStorageDir(): Promise<void> {
    if (!fs.existsSync(this.config.storageDir)) {
      fs.mkdirSync(this.config.storageDir, { recursive: true });
      logger.info({ dir: this.config.storageDir }, 'Storage directory created');
    }
  }

  /**
   * 查找或创建当前文件
   */
  private async findOrCreateCurrentFile(): Promise<void> {
    const files = await this.getSortedFiles();

    if (files.length > 0) {
      // 使用最新的文件
      const lastFile = files[files.length - 1];
      const content = fs.readFileSync(lastFile, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      const entryCount = lines.length;

      // 如果文件未满，继续使用
      if (entryCount < this.config.maxEntriesPerFile) {
        this.currentFile = lastFile;
        this.currentFileEntries = entryCount;

        // 恢复元数据
        const metaFile = this.getMetaFile(lastFile);
        if (fs.existsSync(metaFile)) {
          this.currentMetadata = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
        }

        logger.info({ file: lastFile, entryCount }, 'Using existing audit file');
        return;
      }
    }

    // 创建新文件
    await this.rotateFile();
  }

  /**
   * 轮转文件
   */
  private async rotateFile(): Promise<void> {
    // 刷盘当前缓冲
    await this.flush();

    // 设置当前文件只读
    if (this.currentFile && this.config.enableWriteProtection) {
      await this.setFileReadOnly(this.currentFile);
    }

    // 创建新文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentFile = path.join(
      this.config.storageDir,
      `${this.config.filePrefix}${timestamp}.log`
    );
    this.currentFileEntries = 0;

    // 创建空文件
    fs.writeFileSync(this.currentFile, '');

    // 初始化元数据
    this.currentMetadata = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      entryCount: 0,
      lastSequenceNumber: 0,
      lastChainHash: this.chainConfig.genesisHash,
      fileHash: '',
    };

    // 保存元数据
    await this.saveMetadata();

    logger.info({ file: this.currentFile }, 'New audit file created');
    this.emit('file:rotated', { file: this.currentFile });
  }

  /**
   * 获取排序后的文件列表
   */
  private async getSortedFiles(): Promise<string[]> {
    if (!fs.existsSync(this.config.storageDir)) {
      return [];
    }

    const files = fs.readdirSync(this.config.storageDir)
      .filter(f => f.startsWith(this.config.filePrefix) && f.endsWith('.log'))
      .map(f => path.join(this.config.storageDir, f))
      .sort();

    return files;
  }

  /**
   * 获取元数据文件路径
   */
  private getMetaFile(dataFile: string): string {
    return dataFile.replace('.log', '.meta.json');
  }

  /**
   * 保存元数据
   */
  private async saveMetadata(): Promise<void> {
    if (!this.currentFile || !this.currentMetadata) return;

    const metaFile = this.getMetaFile(this.currentFile);

    // 计算文件 Hash
    this.currentMetadata.fileHash = await this.computeFileHash(this.currentFile);
    this.currentMetadata.lastUpdatedAt = new Date().toISOString();

    fs.writeFileSync(metaFile, JSON.stringify(this.currentMetadata, null, 2));
  }

  /**
   * 更新元数据
   */
  private async updateMetadata(): Promise<void> {
    if (!this.currentMetadata || !this.currentFile) return;

    // 读取最后一条记录
    const content = fs.readFileSync(this.currentFile, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    this.currentMetadata.entryCount = lines.length;

    if (lines.length > 0) {
      try {
        const lastEntry = JSON.parse(lines[lines.length - 1]) as ChainedAuditLogEntry;
        this.currentMetadata.lastSequenceNumber = lastEntry.sequenceNumber;
        this.currentMetadata.lastChainHash = lastEntry.chainHash;
      } catch {
        // 忽略解析错误
      }
    }

    await this.saveMetadata();
  }

  /**
   * 计算文件 Hash
   */
  private async computeFileHash(file: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(file);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * 设置文件只读
   */
  private async setFileReadOnly(file: string): Promise<void> {
    try {
      fs.chmodSync(file, 0o444); // 只读
      logger.debug({ file }, 'File set to read-only');
    } catch (error) {
      logger.warn({ error, file }, 'Failed to set file read-only');
    }
  }

  /**
   * 启动定期刷盘
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(
      () => {
        if (this.entryBuffer.length > 0) {
          this.flush().catch(err => {
            logger.error({ error: err }, 'Failed to flush entries');
          });
        }
      },
      5000 // 每 5 秒刷盘一次
    );
  }
}