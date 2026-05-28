/**
 * Audit Log Chain
 *
 * 链式 Hash 验证系统，确保审计日志不可篡改：
 * - 每条日志包含前一条日志的 Hash
 * - Hash 算法：SHA256(prevHash + logContent)
 * - 支持完整性验证
 * - 支持 PostgreSQL Repository 持久化
 */

import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import {
  ChainedAuditLogEntry,
  ChainConfig,
  ChainVerificationResult,
  ChainBreak,
  DEFAULT_CHAIN_CONFIG,
} from './AuditTypes';
import { OrionError, ErrorCode } from '../../../errors';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'audit-chain' });

/**
 * AuditLogChain 依赖的 Repository 接口
 */
export interface IAuditLogChainRepository {
  getEntries(options?: { startSequence?: number; endSequence?: number; limit?: number }): Promise<ChainedAuditLogEntry[]>;
  getLastEntry(): Promise<ChainedAuditLogEntry | undefined>;
  getNextSequenceNumber(): Promise<number>;
  verifyChain(options?: { startSequence?: number; endSequence?: number }): Promise<ChainVerificationResult>;
}

/**
 * Audit Log Chain
 *
 * 管理审计日志的链式 Hash
 * 支持两种模式：
 * 1. 内存模式 (默认): 使用 Map 存储，适合单实例或不需要持久化的场景
 * 2. PostgreSQL 模式: 使用 Repository 持久化数据
 */
export class AuditLogChain {
  private config: ChainConfig;
  private entries: Map<string, ChainedAuditLogEntry> = new Map();
  private entriesBySequence: Map<number, ChainedAuditLogEntry> = new Map();
  private lastEntry: ChainedAuditLogEntry | null = null;
  private nextSequenceNumber: number = 1;

  // PostgreSQL Repository (可选)
  private repository?: IAuditLogChainRepository;
  private useRepository: boolean = false;

  constructor(config?: Partial<ChainConfig>, repository?: IAuditLogChainRepository) {
    this.config = { ...DEFAULT_CHAIN_CONFIG, ...config };
    this.repository = repository;
    this.useRepository = !!repository;
    logger.info({ algorithm: this.config.algorithm, useRepository: this.useRepository }, 'Audit log chain initialized');
  }

  /**
   * 从 Repository 加载链数据
   */
  async loadFromRepository(): Promise<void> {
    if (!this.repository) {
      throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Repository not configured');
    }

    const entries = await this.repository.getEntries();
    this.addEntries(entries);

    const lastEntry = await this.repository.getLastEntry();
    if (lastEntry) {
      this.lastEntry = lastEntry;
    }

    const nextSeq = await this.repository.getNextSequenceNumber();
    this.nextSequenceNumber = nextSeq;

    logger.info({ count: entries.length, nextSequenceNumber: this.nextSequenceNumber }, 'Chain loaded from repository');
  }

  /**
   * 添加审计日志条目
   */
  addEntry(
    action: string,
    userId: string,
    details: Record<string, any>,
    tenantId?: string
  ): ChainedAuditLogEntry {
    const id = uuidv4();
    const timestamp = new Date();
    const prevHash = this.lastEntry?.chainHash || this.config.genesisHash;
    const sequenceNumber = this.nextSequenceNumber++;

    // 计算内容 Hash
    const content = JSON.stringify({
      id,
      timestamp: timestamp.toISOString(),
      action,
      userId,
      tenantId,
      details,
      sequenceNumber,
    });
    const contentHash = this.hash(content);

    // 计算链 Hash (prevHash + contentHash)
    const chainHash = this.hash(prevHash + contentHash);

    const entry: ChainedAuditLogEntry = {
      id,
      timestamp,
      action,
      userId,
      tenantId,
      prevHash,
      contentHash,
      chainHash,
      details,
      sequenceNumber,
    };

    // 可选签名
    if (this.config.enableSignature && this.config.signingKey) {
      entry.signature = this.sign(chainHash);
    }

    this.entries.set(id, entry);
    this.entriesBySequence.set(sequenceNumber, entry);
    this.lastEntry = entry;

    logger.debug({ id, sequenceNumber, action, userId }, 'Audit entry added to chain');

    return entry;
  }

  /**
   * 批量添加条目 (用于恢复)
   */
  addEntries(entries: ChainedAuditLogEntry[]): { added: number; skipped: number } {
    let added = 0;
    let skipped = 0;

    // 按序列号排序
    const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    for (const entry of sorted) {
      // 验证条目完整性
      if (!this.verifyEntryIntegrity(entry)) {
        logger.warn({ id: entry.id, sequenceNumber: entry.sequenceNumber }, 'Skipping invalid entry');
        skipped++;
        continue;
      }

      // 检查是否已存在
      if (this.entries.has(entry.id)) {
        skipped++;
        continue;
      }

      this.entries.set(entry.id, entry);
      this.entriesBySequence.set(entry.sequenceNumber, entry);

      // 更新链状态
      if (!this.lastEntry || entry.sequenceNumber > this.lastEntry.sequenceNumber) {
        this.lastEntry = entry;
      }

      if (entry.sequenceNumber >= this.nextSequenceNumber) {
        this.nextSequenceNumber = entry.sequenceNumber + 1;
      }

      added++;
    }

    logger.info({ added, skipped }, 'Batch entries added to chain');
    return { added, skipped };
  }

  /**
   * 验证单条日志完整性
   */
  verifyEntryIntegrity(entry: ChainedAuditLogEntry): boolean {
    // 重算内容 Hash
    const content = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp instanceof Date
        ? entry.timestamp.toISOString()
        : new Date(entry.timestamp).toISOString(),
      action: entry.action,
      userId: entry.userId,
      tenantId: entry.tenantId,
      details: entry.details,
      sequenceNumber: entry.sequenceNumber,
    });
    const contentHash = this.hash(content);

    if (contentHash !== entry.contentHash) {
      logger.warn({ id: entry.id }, 'Content hash mismatch');
      return false;
    }

    // 重算链 Hash
    const chainHash = this.hash(entry.prevHash + entry.contentHash);
    if (chainHash !== entry.chainHash) {
      logger.warn({ id: entry.id }, 'Chain hash mismatch');
      return false;
    }

    // 验证签名
    if (this.config.enableSignature && entry.signature) {
      if (!this.verifySignature(entry.chainHash, entry.signature)) {
        logger.warn({ id: entry.id }, 'Signature verification failed');
        return false;
      }
    }

    return true;
  }

  /**
   * 验证整个链的完整性 (内存模式)
   */
  verifyChain(options?: {
    startSequence?: number;
    endSequence?: number;
  }): ChainVerificationResult {
    const startTime = Date.now();
    const breaks: ChainBreak[] = [];
    let verifiedCount = 0;

    const start = options?.startSequence || 1;
    const end = options?.endSequence || this.nextSequenceNumber - 1;

    logger.info({ start, end }, 'Starting chain verification');

    let prevHash = this.config.genesisHash;
    const expectedSequence = start;

    for (let seq = start; seq <= end; seq++) {
      const entry = this.entriesBySequence.get(seq);

      // 检查序列号连续性
      if (!entry) {
        breaks.push({
          sequenceNumber: seq,
          entryId: '',
          expectedHash: '',
          actualHash: '',
          breakType: 'SEQUENCE_GAP',
          description: `Missing entry at sequence ${seq}`,
          detectedAt: new Date(),
        });
        continue;
      }

      // 验证内容 Hash
      const content = JSON.stringify({
        id: entry.id,
        timestamp: entry.timestamp instanceof Date
          ? entry.timestamp.toISOString()
          : new Date(entry.timestamp).toISOString(),
        action: entry.action,
        userId: entry.userId,
        tenantId: entry.tenantId,
        details: entry.details,
        sequenceNumber: entry.sequenceNumber,
      });
      const computedContentHash = this.hash(content);

      if (computedContentHash !== entry.contentHash) {
        breaks.push({
          sequenceNumber: seq,
          entryId: entry.id,
          expectedHash: computedContentHash,
          actualHash: entry.contentHash,
          breakType: 'MODIFIED_CONTENT',
          description: `Content hash mismatch at sequence ${seq}`,
          detectedAt: new Date(),
        });
        // 继续验证后续链
        prevHash = entry.chainHash;
        continue;
      }

      // 验证链 Hash 连续性
      if (entry.prevHash !== prevHash) {
        breaks.push({
          sequenceNumber: seq,
          entryId: entry.id,
          expectedHash: prevHash,
          actualHash: entry.prevHash,
          breakType: 'HASH_MISMATCH',
          description: `Chain hash mismatch at sequence ${seq}: expected prevHash ${prevHash.substring(0, 8)}... but got ${entry.prevHash.substring(0, 8)}...`,
          detectedAt: new Date(),
        });
      }

      // 验证签名
      if (this.config.enableSignature && entry.signature) {
        if (!this.verifySignature(entry.chainHash, entry.signature)) {
          breaks.push({
            sequenceNumber: seq,
            entryId: entry.id,
            expectedHash: '',
            actualHash: '',
            breakType: 'INVALID_SIGNATURE',
            description: `Invalid signature at sequence ${seq}`,
            detectedAt: new Date(),
          });
        }
      }

      prevHash = entry.chainHash;
      verifiedCount++;
    }

    const durationMs = Date.now() - startTime;
    const totalCount = end - start + 1;

    logger.info({
      verifiedCount,
      totalCount,
      breaksCount: breaks.length,
      durationMs,
    }, 'Chain verification completed');

    return {
      valid: breaks.length === 0,
      verifiedCount,
      totalCount,
      breaks,
      verifiedAt: new Date(),
    };
  }

  /**
   * 验证整个链的完整性 (Repository 模式)
   */
  async verifyChainFromRepository(options?: {
    startSequence?: number;
    endSequence?: number;
  }): Promise<ChainVerificationResult> {
    if (!this.repository) {
      throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Repository not configured');
    }
    return this.repository.verifyChain(options);
  }

  /**
   * 获取指定范围的条目
   * 支持从 Repository 或内存获取
   */
  async getEntries(options?: {
    startSequence?: number;
    endSequence?: number;
    limit?: number;
    useRepository?: boolean;
  }): Promise<ChainedAuditLogEntry[]> {
    // 如果使用 Repository
    if (this.useRepository && (options?.useRepository || !this.entries.size)) {
      if (!this.repository) {
        throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Repository not configured');
      }
      return this.repository.getEntries(options);
    }

    const start = options?.startSequence || 1;
    const end = options?.endSequence || this.nextSequenceNumber - 1;
    const limit = options?.limit || 1000;

    const entries: ChainedAuditLogEntry[] = [];
    let count = 0;

    for (let seq = start; seq <= end && count < limit; seq++) {
      const entry = this.entriesBySequence.get(seq);
      if (entry) {
        entries.push(entry);
        count++;
      }
    }

    return entries;
  }

  /**
   * 根据 ID 获取条目
   */
  getEntryById(id: string): ChainedAuditLogEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * 根据序列号获取条目
   */
  getEntryBySequence(sequenceNumber: number): ChainedAuditLogEntry | undefined {
    return this.entriesBySequence.get(sequenceNumber);
  }

  /**
   * 获取最后一条条目
   */
  getLastEntry(): ChainedAuditLogEntry | undefined {
    return this.lastEntry || undefined;
  }

  /**
   * 获取链状态
   */
  getChainState(): {
    totalEntries: number;
    lastSequenceNumber: number;
    lastChainHash: string;
    nextSequenceNumber: number;
  } {
    return {
      totalEntries: this.entries.size,
      lastSequenceNumber: this.lastEntry?.sequenceNumber || 0,
      lastChainHash: this.lastEntry?.chainHash || this.config.genesisHash,
      nextSequenceNumber: this.nextSequenceNumber,
    };
  }

  /**
   * 清空链 (慎用)
   */
  clear(): void {
    this.entries.clear();
    this.entriesBySequence.clear();
    this.lastEntry = null;
    this.nextSequenceNumber = 1;
    logger.warn('Audit chain cleared');
  }

  /**
   * 导出链数据
   */
  export(): ChainedAuditLogEntry[] {
    return Array.from(this.entriesBySequence.values());
  }

  /**
   * 导入链数据
   */
  import(entries: ChainedAuditLogEntry[]): { added: number; skipped: number } {
    return this.addEntries(entries);
  }

  /**
   * 计算 Hash
   */
  private hash(data: string): string {
    return crypto
      .createHash(this.config.algorithm.toLowerCase().replace('sha', 'sha-'))
      .update(data)
      .digest('hex');
  }

  /**
   * 签名
   */
  private sign(data: string): string {
    if (!this.config.signingKey) {
      throw new OrionError(ErrorCode.SERVICE_UNAVAILABLE, 'Signing key not configured');
    }
    return crypto
      .createHmac('sha256', this.config.signingKey)
      .update(data)
      .digest('hex');
  }

  /**
   * 验证签名
   */
  private verifySignature(data: string, signature: string): boolean {
    if (!this.config.signingKey) {
      return true; // 未配置签名密钥时不验证
    }
    const expected = this.sign(data);
    return expected === signature;
  }
}