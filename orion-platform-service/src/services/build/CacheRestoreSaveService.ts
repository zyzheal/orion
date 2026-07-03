/**
 * CacheRestoreSaveService — 构建缓存恢复与保存编排服务
 *
 * 职责：
 * - 在 Stage 执行前恢复缓存
 * - 在 Stage 执行成功后保存缓存
 * - 管理缓存生命周期（恢复 -> 执行 -> 保存）
 * - 集成三级缓存配置（全局 -> 流水线 -> 任务）
 */

import { createLogger } from '../utils/logger';
import { CacheStorageDriver, LocalCacheStorageDriver } from './CacheStorageDriver';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = pino({ name: 'cache-restore-save-service' });

/**
 * Stage 级缓存配置
 */
export interface StageCacheConfig {
  enabled: boolean;
  key: string;
  paths: string[];
  restoreKeys?: string[];
}

/**
 * 缓存恢复结果
 */
export interface CacheRestoreResult {
  restored: boolean;
  matchedKey?: string;
  restoredPaths: string[];
  durationMs: number;
}

/**
 * 缓存保存结果
 */
export interface CacheSaveResult {
  saved: boolean;
  sizeBytes: number;
  durationMs: number;
}

export class CacheRestoreSaveService {
  private driver: CacheStorageDriver;

  constructor(driver?: CacheStorageDriver) {
    this.driver = driver || new LocalCacheStorageDriver();
  }

  /**
   * 初始化缓存驱动
   */
  async init(): Promise<void> {
    if (this.driver instanceof LocalCacheStorageDriver) {
      await (this.driver as LocalCacheStorageDriver).init();
    }
  }

  /**
   * 恢复缓存（在 Stage 任务执行前调用）
   *
   * @param cacheConfig Stage 级缓存配置
   * @param workspaceDir 工作目录（缓存恢复的目标）
   * @returns 恢复结果
   */
  async restoreCache(
    cacheConfig: StageCacheConfig,
    workspaceDir: string
  ): Promise<CacheRestoreResult> {
    const startTime = Date.now();

    if (!cacheConfig.enabled) {
      logger.debug({ key: cacheConfig.key }, 'Cache is disabled for this stage');
      return { restored: false, restoredPaths: [], durationMs: 0 };
    }

    logger.info({ key: cacheConfig.key, workspace: workspaceDir }, 'Restoring cache');

    try {
      const restoreKeys = cacheConfig.restoreKeys || [];
      const result = await this.driver.restore(
        cacheConfig.key,
        restoreKeys,
        workspaceDir
      );

      const durationMs = Date.now() - startTime;

      if (result.matched) {
        logger.info(
          { key: result.matchedKey, paths: result.restoredPaths.length },
          `Cache restored in ${durationMs}ms`
        );
      } else {
        logger.debug({ key: cacheConfig.key }, 'No cache found for key');
      }

      return {
        restored: result.matched,
        matchedKey: result.matchedKey,
        restoredPaths: result.restoredPaths,
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ traceId: getCurrentTraceId(), error: errorMessage }, 'Cache restore failed');

      return {
        restored: false,
        restoredPaths: [],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 保存缓存（在 Stage 任务执行成功后调用）
   *
   * @param cacheConfig Stage 级缓存配置
   * @param workspaceDir 工作目录（缓存保存的源）
   * @returns 保存结果
   */
  async saveCache(
    cacheConfig: StageCacheConfig,
    workspaceDir: string
  ): Promise<CacheSaveResult> {
    const startTime = Date.now();

    if (!cacheConfig.enabled) {
      return { saved: false, sizeBytes: 0, durationMs: 0 };
    }

    logger.info({ key: cacheConfig.key, workspace: workspaceDir }, 'Saving cache');

    try {
      const result = await this.driver.save(
        cacheConfig.key,
        cacheConfig.paths,
        workspaceDir
      );

      const durationMs = Date.now() - startTime;

      if (result.saved) {
        logger.info(
          { key: cacheConfig.key, sizeBytes: result.sizeBytes },
          `Cache saved in ${durationMs}ms`
        );
      } else {
        logger.debug({ key: cacheConfig.key }, 'No files to cache');
      }

      return {
        saved: result.saved,
        sizeBytes: result.sizeBytes,
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ traceId: getCurrentTraceId(), error: errorMessage }, 'Cache save failed');

      return {
        saved: false,
        sizeBytes: 0,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * 合并三级缓存配置
   * 优先级：Stage > Pipeline > Global
   */
  static mergeCacheConfigs(
    global?: StageCacheConfig,
    pipeline?: StageCacheConfig,
    stage?: StageCacheConfig
  ): StageCacheConfig {
    return {
      enabled: stage?.enabled ?? pipeline?.enabled ?? global?.enabled ?? false,
      key: stage?.key || pipeline?.key || global?.key || '',
      paths: stage?.paths || pipeline?.paths || global?.paths || [],
      restoreKeys: stage?.restoreKeys || pipeline?.restoreKeys || global?.restoreKeys,
    };
  }
}
