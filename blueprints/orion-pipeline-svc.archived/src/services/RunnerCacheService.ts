/**
 * RunnerCacheService - Runner 层缓存服务 (Task 1.3)
 *
 * 职责：
 * - 缓存目录/文件的保存与恢复
 * - 缓存键生成与匹配 (精确 + 前缀)
 * - 缓存过期清理 (TTL)
 * - 缓存大小统计
 *
 * 并发控制：
 * - Redis 分布式锁：处理资源级互斥（同一缓存键的并发读写）
 * - PostgreSQL 乐观锁：处理状态更新（version 字段防止并发写入丢失）
 * - 缓存键版本化：保证缓存一致性（键格式：{type}-{identifier}-v{version}）
 *
 * 支持：npm/node_modules, pip/cache, go/mod, maven/repository
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import pino from 'pino';
import Redis from 'ioredis';
import { Pool } from 'pg';
import { RunnerCacheRepository } from '../repositories/RunnerCacheRepository';

const logger = pino({ name: 'runner-cache-service' });

export interface CacheEntry {
  key: string;
  paths: string[];
  size: number;
  createdAt: string;
  expiresAt: string;
  hash: string;
  runId: string;
  stageId: string;
}

export interface CacheConfig {
  /** 缓存根目录 */
  cacheDir?: string;
  /** 默认最大保留时间 (秒) */
  defaultMaxAge?: number;
  /** 缓存大小限制 (字节) */
  maxSizeBytes?: number;
  /** Redis 锁超时时间 (秒) */
  lockTtl?: number;
  /** 是否启用 Redis 锁 */
  enableRedisLock?: boolean;
}

export class RunnerCacheService {
  private cacheDir: string;
  private defaultMaxAge: number;
  private maxSizeBytes: number;
  private lockTtl: number;
  private enableRedisLock: boolean;
  private redis: Redis | null = null;
  private repository: RunnerCacheRepository | null = null;

  constructor(config?: CacheConfig, redis?: Redis, pool?: Pool) {
    this.cacheDir = config?.cacheDir || '/tmp/orion-cache';
    this.defaultMaxAge = config?.defaultMaxAge || 86400;
    this.maxSizeBytes = config?.maxSizeBytes || 10 * 1024 * 1024 * 1024;
    this.lockTtl = config?.lockTtl || 30;
    this.enableRedisLock = config?.enableRedisLock ?? true;

    if (redis) {
      this.redis = redis;
    }
    if (pool) {
      this.repository = new RunnerCacheRepository(pool);
    }

    // 确保缓存目录存在
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * 保存缓存
   * 使用 Redis 分布式锁保证同一缓存键的互斥写入
   * 使用 PostgreSQL 乐观锁保证元数据更新一致性
   */
  async saveCache(
    runId: string,
    stageId: string,
    key: string,
    cachePaths: string[],
    maxAge?: number
  ): Promise<CacheEntry | null> {
    const cacheKey = this.generateCacheKey(key);
    const entryDir = path.join(this.cacheDir, cacheKey);
    const lockResource = `cache:${cacheKey}`;

    // 1. 获取分布式锁
    const lockValue = await this.acquireLock(lockResource, runId);

    try {
      // 2. 创建缓存目录
      if (!fs.existsSync(entryDir)) {
        fs.mkdirSync(entryDir, { recursive: true });
      }

      // 3. 复制缓存文件/目录
      let totalSize = 0;
      for (const cachePath of cachePaths) {
        if (fs.existsSync(cachePath)) {
          const destPath = path.join(entryDir, this.sanitizePath(cachePath));
          await this.copyPath(cachePath, destPath);
          totalSize += await this.getPathSize(cachePath);
        }
      }

      // 4. 检查缓存大小限制
      if (totalSize > this.maxSizeBytes) {
        logger.warn(
          { size: totalSize, limit: this.maxSizeBytes },
          'Cache entry exceeds size limit, skipping'
        );
        fs.rmSync(entryDir, { recursive: true, force: true });
        return null;
      }

      // 5. 构建元数据
      const ttl = maxAge || this.defaultMaxAge;
      const entry: CacheEntry = {
        key,
        paths: cachePaths,
        size: totalSize,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        hash: cacheKey,
        runId,
        stageId,
      };

      // 6. 保存本地元数据文件
      fs.writeFileSync(
        path.join(entryDir, '.metadata.json'),
        JSON.stringify(entry, null, 2)
      );

      // 7. 保存/更新 PostgreSQL 元数据
      if (this.repository) {
        await this.repository.insert(entry, cacheKey);
      }

      logger.info(
        { key, size: totalSize, paths: cachePaths.length },
        'Cache saved'
      );

      return entry;
    } catch (error: any) {
      logger.error({ error, key }, 'Failed to save cache');
      if (fs.existsSync(entryDir)) {
        fs.rmSync(entryDir, { recursive: true, force: true });
      }
      return null;
    } finally {
      // 8. 释放锁（仅一次）
      await this.releaseLock(lockResource, lockValue);
    }
  }

  /**
   * 恢复缓存
   * 优先精确匹配，其次前缀匹配
   * 使用 Redis 锁防止恢复过程中缓存被删除
   */
  async restoreCache(
    key: string,
    restoreKeys?: string[]
  ): Promise<{ restored: boolean; key: string; paths: string[] }> {
    const cacheKey = this.generateCacheKey(key);

    // 1. 尝试精确匹配
    let entry: CacheEntry | null = null;
    if (this.repository) {
      entry = await this.repository.findByHash(cacheKey);
    } else {
      entry = this.readLocalMetadata(cacheKey);
    }

    if (entry && !this.isExpired(entry)) {
      const entryDir = path.join(this.cacheDir, cacheKey);
      if (fs.existsSync(entryDir)) {
        await this.restoreEntry(entryDir, entry);
        await this.repository?.recordHit(cacheKey);
        logger.info({ key }, 'Cache restored (exact match)');
        return { restored: true, key, paths: entry.paths };
      }
    }

    // 记录未命中
    await this.repository?.recordMiss(cacheKey);

    // 2. 尝试前缀匹配 (restoreKeys)
    if (restoreKeys && restoreKeys.length > 0) {
      for (const prefix of restoreKeys) {
        let candidates: CacheEntry[] = [];

        if (this.repository) {
          candidates = await this.repository.findByPrefix(prefix);
        } else {
          // 降级到本地文件匹配：使用原始 key 前缀匹配
          candidates = this.listLocalMetadata().filter(e =>
            e.key.startsWith(prefix) && !this.isExpired(e)
          );
        }

        // 选择最新的候选
        candidates.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        if (candidates.length > 0) {
          const bestMatch = candidates[0];
          const matchDir = path.join(this.cacheDir, bestMatch.hash);
          if (fs.existsSync(matchDir)) {
            await this.restoreEntry(matchDir, bestMatch);
            await this.repository?.recordHit(bestMatch.hash);
            logger.info(
              { key: bestMatch.key, prefix },
              'Cache restored (prefix match)'
            );
            return { restored: true, key: bestMatch.key, paths: bestMatch.paths };
          }
        }
      }
    }

    logger.info({ key }, 'Cache not found');
    return { restored: false, key, paths: [] };
  }

  /**
   * 清理过期缓存
   * 使用 PostgreSQL 批量清理元数据，然后删除本地文件
   */
  async cleanup(): Promise<{ cleaned: number; freedBytes: number }> {
    let cleaned = 0;
    let freedBytes = 0;

    if (this.repository) {
      // 使用 PostgreSQL 直接查询过期条目
      const expiredEntries = await this.repository.findExpired();

      for (const entry of expiredEntries) {
        const entryDir = path.join(this.cacheDir, entry.hash);
        if (fs.existsSync(entryDir)) {
          const size = await this.getPathSize(entryDir);
          fs.rmSync(entryDir, { recursive: true, force: true });
          cleaned++;
          freedBytes += size;
        }
      }

      await this.repository.cleanupExpired();
    } else {
      // 降级到本地文件清理
      const entries = fs.readdirSync(this.cacheDir);

      for (const entry of entries) {
        if (entry.startsWith('.')) continue;

        const entryDir = path.join(this.cacheDir, entry);
        const metadataPath = path.join(entryDir, '.metadata.json');

        if (fs.existsSync(metadataPath)) {
          try {
            const metadata: CacheEntry = JSON.parse(
              fs.readFileSync(metadataPath, 'utf-8')
            );

            if (this.isExpired(metadata)) {
              const size = await this.getPathSize(entryDir);
              fs.rmSync(entryDir, { recursive: true, force: true });
              cleaned++;
              freedBytes += size;
            }
          } catch {
            fs.rmSync(entryDir, { recursive: true, force: true });
            cleaned++;
          }
        }
      }
    }

    logger.info({ cleaned, freedBytes }, 'Cache cleanup completed');
    return { cleaned, freedBytes };
  }

  /**
   * 获取缓存统计信息
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    expiredCount: number;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    if (this.repository) {
      return await this.repository.getStats();
    }

    // 降级到本地统计
    const entries = this.listLocalMetadata();
    let totalSize = 0;
    let expiredCount = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    for (const entry of entries) {
      totalSize += entry.size;
      if (this.isExpired(entry)) expiredCount++;

      if (!oldest || entry.createdAt < oldest) oldest = entry.createdAt;
      if (!newest || entry.createdAt > newest) newest = entry.createdAt;
    }

    return {
      totalEntries: entries.length,
      totalSize,
      expiredCount,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  // ==================== 缓存键版本化 ====================

  /**
   * 生成带版本号的缓存键
   * 格式: {type}-{identifier}-v{version}
   * 示例: npm-node-modules-v1.0.0, pip-requirements-v2.1.0
   */
  static versionedCacheKey(
    type: string,
    identifier: string,
    version: string = '1.0.0'
  ): string {
    return `${type}-${identifier}-v${version}`;
  }

  /**
   * 解析版本化缓存键
   * @returns { type, identifier, version } 或 null
   */
  static parseVersionedKey(key: string): { type: string; identifier: string; version: string } | null {
    // 匹配格式: {type}-{identifier}-v{version}
    // version 格式: X.Y.Z 在字符串末尾
    const versionMatch = key.match(/^(.+)-(.+)-v(\d+\.\d+\.\d+)$/);
    if (!versionMatch) return null;

    // type 是第一个 - 之前的部分
    const firstDash = key.indexOf('-');
    // identifier 是 type 和 -v{version} 之间的部分
    const versionSuffix = `-v${versionMatch[3]}`;
    const identifierStart = firstDash + 1;
    const identifierEnd = key.length - versionSuffix.length;

    return {
      type: key.substring(0, firstDash),
      identifier: key.substring(identifierStart, identifierEnd),
      version: versionMatch[3],
    };
  }

  // ==================== 分布式锁 ====================

  /**
   * Lua 脚本：安全释放锁
   * 只有当锁的值匹配期望值时才删除，防止误删其他进程的锁
   */
  private readonly RELEASE_LOCK_LUA = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;

  /**
   * 获取 Redis 分布式锁
   */
  private async acquireLock(resource: string, ownerId: string): Promise<string | null> {
    if (!this.enableRedisLock || !this.redis) {
      return null; // 无锁模式
    }

    try {
      const key = `orion:lock:${resource}`;
      const value = `${ownerId}:${Date.now()}`;

      const result = await this.redis.set(key, value, 'EX', this.lockTtl, 'NX');
      return result === 'OK' ? value : null;
    } catch (error) {
      logger.warn({ error, resource }, 'Redis lock acquisition failed, using lock-free mode');
      return null;
    }
  }

  /**
   * 释放 Redis 分布式锁
   * 使用 Lua 脚本保证只释放自己的锁
   */
  private async releaseLock(resource: string, lockValue: string | null): Promise<void> {
    if (!lockValue || !this.redis) {
      return;
    }

    try {
      const key = `orion:lock:${resource}`;
      await this.redis.eval(this.RELEASE_LOCK_LUA, 1, key, lockValue);
    } catch (error) {
      logger.warn({ error, resource }, 'Failed to release lock');
    }
  }

  // ==================== 本地缓存元数据 (降级方案) ====================

  private readLocalMetadata(hash: string): CacheEntry | null {
    const entryDir = path.join(this.cacheDir, hash);
    const metadataPath = path.join(entryDir, '.metadata.json');

    if (!fs.existsSync(metadataPath)) return null;

    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private listLocalMetadata(): CacheEntry[] {
    const entries: CacheEntry[] = [];
    const items = fs.readdirSync(this.cacheDir);

    for (const item of items) {
      if (item.startsWith('.')) continue;
      const entryDir = path.join(this.cacheDir, item);
      const metadata = this.readLocalMetadata(item);
      if (metadata) {
        entries.push(metadata);
      }
    }

    return entries;
  }

  // ==================== 内部工具方法 ====================

  /**
   * 生成缓存键的哈希值
   */
  private generateCacheKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  }

  /**
   * 安全化路径 (用于目录名)
   */
  private sanitizePath(p: string): string {
    return p.replace(/[\/\\]/g, '_').replace(/\./g, '_');
  }

  /**
   * 复制文件或目录
   */
  private async copyPath(src: string, dest: string): Promise<void> {
    try {
      await fs.promises.cp(src, dest, { recursive: true, force: true });
    } catch (error: any) {
      logger.error({ error, src, dest }, 'Failed to copy path');
      throw error;
    }
  }

  /**
   * 获取路径大小
   */
  private async getPathSize(p: string): Promise<number> {
    try {
      const stat = await fs.promises.stat(p);
      if (stat.isDirectory()) {
        let size = 0;
        const entries = await fs.promises.readdir(p);
        for (const entry of entries) {
          size += await this.getPathSize(path.join(p, entry));
        }
        return size;
      }
      return stat.size;
    } catch {
      return 0;
    }
  }

  /**
   * 恢复缓存条目到目标路径
   */
  private async restoreEntry(entryDir: string, metadata: CacheEntry): Promise<void> {
    for (const cachePath of metadata.paths) {
      const srcPath = path.join(entryDir, this.sanitizePath(cachePath));
      if (fs.existsSync(srcPath)) {
        const targetDir = path.dirname(cachePath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        await this.copyPath(srcPath, cachePath);
      }
    }
  }

  /**
   * 检查缓存是否过期
   */
  private isExpired(entry: CacheEntry): boolean {
    return new Date() > new Date(entry.expiresAt);
  }
}
