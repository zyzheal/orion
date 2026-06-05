/**
 * CacheStorageDriver — 缓存存储驱动接口与本地文件系统实现
 *
 * 提供可插拔的缓存存储后端支持：
 * - LocalCacheStorageDriver: 本地文件系统（默认）
 * - 可扩展 S3/OSS/Redis 等后端
 */

import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import pino from 'pino';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'cache-storage-driver' });

export interface CacheEntry {
  key: string;
  paths: string[];
  restoredAt?: Date;
  savedAt?: Date;
  sizeBytes: number;
}

/**
 * 缓存存储驱动接口
 */
export interface CacheStorageDriver {
  /**
   * 恢复缓存：根据 key 查找并解压到指定目录
   */
  restore(
    key: string,
    restoreKeys: string[],
    targetDir: string
  ): Promise<{ matched: boolean; matchedKey?: string; restoredPaths: string[] }>;

  /**
   * 保存缓存：将指定路径打包并存储
   */
  save(
    key: string,
    paths: string[],
    baseDir: string
  ): Promise<{ saved: boolean; sizeBytes: number }>;

  /**
   * 清理过期缓存
   */
  cleanup(maxAgeDays: number): Promise<{ removedCount: number; freedBytes: number }>;

  /**
   * 获取缓存统计信息
   */
  stats(): Promise<{ totalEntries: number; totalSizeBytes: number }>;
}

/**
 * 本地文件系统缓存存储驱动
 */
export class LocalCacheStorageDriver implements CacheStorageDriver {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.env.TMPDIR || '/tmp', 'orion-cache');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    logger.info({ cacheDir: this.cacheDir }, 'Local cache storage initialized');
  }

  async restore(
    key: string,
    restoreKeys: string[],
    targetDir: string
  ): Promise<{ matched: boolean; matchedKey?: string; restoredPaths: string[] }> {
    await this.init();

    // 先尝试精确匹配
    const exactMatch = await this.tryRestoreKey(key, targetDir);
    if (exactMatch.matched) {
      return exactMatch;
    }

    // 再尝试前缀匹配（restoreKeys）
    for (const restoreKey of restoreKeys) {
      const match = await this.tryRestoreKey(restoreKey, targetDir, true);
      if (match.matched) {
        return match;
      }
    }

    return { matched: false, restoredPaths: [] };
  }

  async save(
    key: string,
    paths: string[],
    baseDir: string
  ): Promise<{ saved: boolean; sizeBytes: number }> {
    await this.init();

    const destPath = this.getCacheFilePath(key);
    let totalSize = 0;

    try {
      // 收集要缓存的文件
      const files = await this.collectFiles(paths, baseDir);
      if (files.length === 0) {
        logger.debug({ key, paths }, 'No files found for caching');
        return { saved: false, sizeBytes: 0 };
      }

      // 创建缓存目录
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // 打包为 tar
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const fileList = files.join(' ');
      const cmd = `cd ${baseDir} && tar cf ${destPath} ${fileList}`;
      await execAsync(cmd, { timeout: 5 * 60 * 1000 });

      // 计算大小
      const stat = await fs.stat(destPath);
      totalSize = stat.size;

      // 保存元数据
      await this.saveMetadata(key, {
        key,
        paths,
        savedAt: new Date(),
        sizeBytes: totalSize,
      });

      logger.info({ key, filesCount: files.length, sizeBytes: totalSize }, 'Cache saved');

      return { saved: true, sizeBytes: totalSize };
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), key, error }, 'Failed to save cache');
      // 清理可能的部分文件
      try {
        await fs.unlink(destPath);
      } catch {
        // ignore
      }
      return { saved: false, sizeBytes: 0 };
    }
  }

  async cleanup(maxAgeDays: number): Promise<{ removedCount: number; freedBytes: number }> {
    await this.init();

    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;
    let freedBytes = 0;

    try {
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metaPath = path.join(this.cacheDir, entry.name, 'meta.json');
          try {
            const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
            if (meta.savedAt && new Date(meta.savedAt) < cutoffDate) {
              const stats = await this.getDirSize(path.join(this.cacheDir, entry.name));
              await fs.rm(path.join(this.cacheDir, entry.name), { recursive: true });
              removedCount++;
              freedBytes += stats;
            }
          } catch {
            // 无法读取元数据，跳过
          }
        }
      }
    } catch (error) {
      logger.error({ traceId: getCurrentTraceId(), error }, 'Cache cleanup failed');
    }

    logger.info({ removedCount, freedBytes }, 'Cache cleanup completed');
    return { removedCount, freedBytes };
  }

  async stats(): Promise<{ totalEntries: number; totalSizeBytes: number }> {
    await this.init();

    let totalEntries = 0;
    let totalSize = 0;

    try {
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          totalEntries++;
          const dirStats = await this.getDirSize(path.join(this.cacheDir, entry.name));
          totalSize += dirStats;
        }
      }
    } catch {
      // ignore
    }

    return { totalEntries, totalSizeBytes: totalSize };
  }

  /**
   * 尝试用给定 key 恢复缓存
   */
  private async tryRestoreKey(
    key: string,
    targetDir: string,
    prefixMatch = false
  ): Promise<{ matched: boolean; matchedKey?: string; restoredPaths: string[] }> {
    try {
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryKey = entry.name;
          const isMatch = prefixMatch
            ? entryKey.startsWith(key.replace(/\*$/, ''))
            : entryKey === key;

          if (isMatch) {
            const cacheFile = path.join(this.cacheDir, entry.name, 'archive.tar');
            if (await this.fileExists(cacheFile)) {
              // 解压
              const { exec } = await import('child_process');
              const { promisify } = await import('util');
              const execAsync = promisify(exec);

              await fs.mkdir(targetDir, { recursive: true });
              await execAsync(`tar xf ${cacheFile} -C ${targetDir}`, {
                timeout: 5 * 60 * 1000,
              });

              const meta = await this.loadMetadata(entry.name);
              logger.info({ key: entry.name, paths: meta?.paths }, 'Cache restored');

              return {
                matched: true,
                matchedKey: entry.name,
                restoredPaths: meta?.paths || [],
              };
            }
          }
        }
      }
    } catch (error) {
      logger.warn({ traceId: getCurrentTraceId(), key, error }, 'Failed to restore cache entry');
    }

    return { matched: false, restoredPaths: [] };
  }

  /**
   * 收集匹配的文件
   */
  private async collectFiles(patterns: string[], baseDir: string): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of patterns) {
      try {
        const globModule = await import('glob');
        const globFn = (globModule as any).glob || (globModule as any).GlobSync || globModule.default;
        if (typeof globFn === 'function') {
          const matches = await globFn(pattern, { cwd: baseDir, nodir: true });
          if (Array.isArray(matches)) {
            files.push(...matches);
          }
        }
      } catch {
        // glob not available, fallback to direct path
        const fullPath = path.join(baseDir, pattern);
        if (await this.fileExists(fullPath)) {
          files.push(pattern);
        }
      }
    }

    // 去重
    return [...new Set(files)];
  }

  /**
   * 获取缓存文件路径
   */
  private getCacheFilePath(key: string): string {
    const hash = createHash('md5').update(key).digest('hex');
    return path.join(this.cacheDir, hash, 'archive.tar');
  }

  /**
   * 保存元数据
   */
  private async saveMetadata(key: string, meta: Partial<CacheEntry>): Promise<void> {
    const dir = path.dirname(this.getCacheFilePath(key));
    await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  }

  /**
   * 加载元数据
   */
  private async loadMetadata(key: string): Promise<Partial<CacheEntry> | null> {
    try {
      // Find the directory by key hash
      const hash = createHash('md5').update(key).digest('hex');
      const metaPath = path.join(this.cacheDir, hash, 'meta.json');
      const content = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 递归计算目录大小
   */
  private async getDirSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirSize(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          size += stat.size;
        }
      }
    } catch {
      // ignore
    }
    return size;
  }
}
