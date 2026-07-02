/**
 * SbomService - 统一 SBOM 服务
 *
 * 整合现有双 SBOM 实现:
 * - SbomVulnerabilityService (sbom/SbomVulnerabilityService.ts) — 侧重 SBOM 文档扫描
 * - VulnerabilityDatabaseClient (sbom/VulnerabilityDatabaseClient.ts) — 侧重实时漏洞数据库查询
 *
 * 本服务提供统一接口，底层使用 VulnerabilityDatabaseClient，并内置 30min TTL 缓存。
 */

import { VulnerabilityDatabaseClient } from '../sbom/VulnerabilityDatabaseClient';
import { VulnerabilityCache } from '../sbom/VulnerabilityCache';
import { createLogger } from '../../utils/logger';

const logger = createLogger('supply-chain-sbom');

// Re-export types for convenience
export type {
  VulnerabilityReport,
  SBOMComponent,
  SBOM,
  LicenseInfo,
  DependencyTree,
  DependencyNode,
  ComplianceResult,
  ComplianceViolation,
  CompliancePolicy,
  SupplyChainReport,
  PackageJsonInput,
} from './types';

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟
const DEFAULT_CACHE_MAX_ENTRIES = 1000;

// ==================== SbomService ====================

export class SbomService {
  private client: VulnerabilityDatabaseClient;
  private cache: VulnerabilityCache<VulnerabilityReport['vulnerabilities']>;

  constructor(options?: { nvdApiKey?: string; cacheTtlMs?: number; cacheMaxEntries?: number }) {
    this.client = new VulnerabilityDatabaseClient({ nvdApiKey: options?.nvdApiKey });
    this.cache = new VulnerabilityCache<VulnerabilityReport['vulnerabilities']>({
      ttlMs: options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
      maxEntries: options?.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES,
    });
  }

  // ==================== Vulnerability Fetching ====================

  /**
   * 从 NVD/OSV 实时查询组件漏洞
   *
   * @param component - 组件信息 { name, version, ecosystem? }
   * @returns 漏洞报告
   */
  async fetchVulnerabilities(component: {
    name: string;
    version: string;
    ecosystem?: string;
  }): Promise<VulnerabilityReport> {
    const startTime = Date.now();
    const ecosystem = component.ecosystem ?? 'Maven';

    logger.info(
      { component: component.name, version: component.version, ecosystem },
      '[SbomService] Fetching vulnerabilities from external DB',
    );

    try {
      // 优先从 OSV 查询（更快的响应速度，支持包名匹配）
      const osvResult = await this.client.fetchFromOSV(component.name, component.version, ecosystem);

      // 如果 OSV 没有结果，回退到 NVD keyword search
      let vulnerabilities = osvResult.vulnerabilities;
      let source: 'nvd' | 'osv' = 'osv';

      if (vulnerabilities.length === 0) {
        logger.debug(
          { component: component.name, version: component.version },
          '[SbomService] OSV returned no results, falling back to NVD keyword search',
        );
        const nvdResult = await this.client.searchNVD(`${component.name} ${component.version}`, 20);
        vulnerabilities = nvdResult.vulnerabilities;
        source = 'nvd';
      }

      const report: VulnerabilityReport = {
        component: {
          name: component.name,
          version: component.version,
          ecosystem,
        },
        source,
        cached: false,
        vulnerabilities,
        queryTime: Date.now() - startTime,
        scannedAt: new Date(),
      };

      logger.info(
        { component: component.name, vulnCount: vulnerabilities.length, source, queryTime: report.queryTime },
        '[SbomService] Vulnerability fetch completed',
      );

      return report;
    } catch (error) {
      logger.error(
        { component: component.name, version: component.version, err: error instanceof Error ? error.message : String(error) },
        '[SbomService] Failed to fetch vulnerabilities',
      );
      throw error;
    }
  }

  /**
   * 从缓存获取组件漏洞（30min TTL）
   *
   * @param component - 组件信息
   * @returns 漏洞报告（可能来自缓存）
   */
  async getCachedVulnerabilities(component: {
    name: string;
    version: string;
    ecosystem?: string;
  }): Promise<VulnerabilityReport> {
    const ecosystem = component.ecosystem ?? 'Maven';
    const cacheKey = VulnerabilityCache.buildKey('static', `${component.name}:${component.version}:${ecosystem}`);

    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(
        { component: component.name, version: component.version, hits: cached.hits },
        '[SbomService] Returning cached vulnerability report',
      );

      return {
        component: {
          name: component.name,
          version: component.version,
          ecosystem,
        },
        source: cached.source as 'nvd' | 'osv' | 'static',
        cached: true,
        vulnerabilities: cached.value,
        queryTime: 0,
        scannedAt: new Date(cached.createdAt),
      };
    }

    // Cache miss - fetch from external DB
    const report = await this.fetchVulnerabilities(component);

    // Store in cache
    this.cache.set(
      cacheKey,
      report.vulnerabilities,
      report.source,
    );

    return report;
  }

  // ==================== Cache Management ====================

  /**
   * 预热缓存（批量预加载）
   */
  async warmupCache(components: Array<{ name: string; version: string; ecosystem?: string }>): Promise<void> {
    logger.info({ count: components.length }, '[SbomService] Warming up vulnerability cache');

    const entries = await Promise.all(
      components.map(async (component) => {
        const report = await this.fetchVulnerabilities(component);
        const ecosystem = component.ecosystem ?? 'Maven';
        const cacheKey = VulnerabilityCache.buildKey('static', `${component.name}:${component.version}:${ecosystem}`);

        return {
          key: cacheKey,
          value: report.vulnerabilities,
          source: report.source as 'nvd' | 'osv' | 'static',
        };
      }),
    );

    this.cache.warmup(entries);
    logger.info({ count: entries.length }, '[SbomService] Cache warmup completed');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清理过期缓存条目
   */
  cleanupExpiredCache(): number {
    return this.cache.cleanupExpired();
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[SbomService] Cache cleared');
  }
}

export default SbomService;
