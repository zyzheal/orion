// orion-platform-service/src/services/security/NVDClient.ts
/**
 * NVD API 2.0 客户端
 *
 * 功能:
 * - 按 CPE 或关键词搜索 CVE
 * - 获取 CVSS 评分
 * - 30 分钟内存缓存
 * - 优雅降级（NVD 不可用时返回空结果，不抛异常）
 * - tenant_id 隔离
 */

import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { safeFetch } from '../../utils/safeFetch';

const logger = createLogger('nvd-client');

// ==================== Types ====================

export interface NVDCVE {
  id: string;
  description: string;
  cvssScore?: number;
  cvssSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'none';
  publishedDate?: string;
  lastModifiedDate?: string;
  references?: { url: string; source: string }[];
  cpeMatch?: {
    cpeName: string;
    versionStartIncluding?: string;
    versionEndExcluding?: string;
  }[];
  fixAvailable?: boolean;
  fixedVersion?: string;
}

export interface NVDSearchOptions {
  keyword?: string;
  cpeName?: string;
  cveId?: string;
  tenantId?: string | null;
}

interface NVDResponse {
  resultsPerPage: number;
  startIndex: number;
  totalResults: number;
  vulnerabilities: {
    cve: {
      id: string;
      descriptions: { lang: string; value: string }[];
      published: string;
      lastModified: string;
      references?: { url: string; source: string }[];
      metrics?: {
        cvssMetricV31?: {
          cvssData: {
            baseScore: number;
            baseSeverity: string;
          };
          exploitabilityScore?: number;
          impactScore?: number;
        }[];
        cvssMetricV2?: {
          cvssData: {
            baseScore: number;
          };
        }[];
      };
      configurations?: {
        nodes: {
          cpeMatch: {
            cpeName: string;
            versionStartIncluding?: string;
            versionEndExcluding?: string;
            vulnerable: boolean;
          }[];
        }[];
      }[];
    };
  }[];
}

// ==================== Cache ====================

interface CacheEntry {
  timestamp: number;
  data: NVDCVE[];
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟
const cache = new Map<string, CacheEntry>();

function getCacheKey(tenantId: string | null | undefined, options: NVDSearchOptions): string {
  const t = tenantId ?? 'global';
  if (options.cveId) return `${t}:cve:${options.cveId}`;
  if (options.cpeName) return `${t}:cpe:${options.cpeName}`;
  return `${t}:keyword:${options.keyword ?? ''}`;
}

function getCached(key: string): NVDCVE[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NVDCVE[]): void {
  cache.set(key, { timestamp: Date.now(), data });
}

// ==================== Client ====================

const NVD_BASE_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

/**
 * NVD API 2.0 客户端
 */
export class NVDClient {
  private tenantId: string | null;

  constructor(tenantId?: string | null) {
    this.tenantId = tenantId ?? null;
  }

  /**
   * 设置 tenant_id（用于租户隔离）
   */
  setTenantId(tenantId: string | null): void {
    this.tenantId = tenantId;
  }

  /**
   * 搜索 CVE
   *
   * 支持按 keyword、cpeName、cveId 查询
   * 优先从缓存读取，缓存未命中时调用 NVD API
   *
   * @param options - 搜索选项
   * @returns CVE 列表，NVD 不可用时返回空数组
   */
  async searchCVE(options: NVDSearchOptions): Promise<NVDCVE[]> {
    // 如果 NVD 不可用，优雅降级返回空结果
    if (!this.isNVDAvailable()) {
      logger.warn({ tenantId: this.tenantId, options }, '[NVDClient] NVD unavailable, returning empty results');
      return [];
    }

    const cacheKey = getCacheKey(this.tenantId, options);
    const cached = getCached(cacheKey);
    if (cached) {
      logger.debug({ tenantId: this.tenantId, options, cacheHit: true, count: cached.length }, '[NVDClient] Cache hit');
      return cached;
    }

    let url: string;
    try {
      url = this.buildSearchUrl(options);
    } catch (error) {
      logger.warn({ error, options }, '[NVDClient] Failed to build search URL');
      return [];
    }

    try {
      logger.debug({ tenantId: this.tenantId, options, url }, '[NVDClient] Querying NVD API');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超时

      const response = await safeFetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Orion-Platform-Service/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(
          { tenantId: this.tenantId, status: response.status, options },
          '[NVDClient] NVD API returned non-OK status',
        );
        return [];
      }

      const data = (await response.json()) as NVDResponse;
      const cves = this.parseNVDResponse(data);

      logger.info(
        { tenantId: this.tenantId, options, count: cves.length },
        '[NVDClient] Successfully fetched CVE data from NVD',
      );

      setCache(cacheKey, cves);
      return cves;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('aborted')) {
        logger.warn({ tenantId: this.tenantId, options, url }, '[NVDClient] NVD API request timed out');
      } else {
        logger.warn({ error, tenantId: this.tenantId, options, url }, '[NVDClient] NVD API request failed');
      }
      return [];
    }
  }

  /**
   * 根据 CVE ID 获取详情
   *
   * @param cveId - CVE ID（如 CVE-2021-44228）
   * @returns CVE 详情，未找到或出错时返回 null
   */
  async getCVEDetails(cveId: string): Promise<NVDCVE | null> {
    const results = await this.searchCVE({ cveId });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 检查 NVD API 是否可用（快速检查）
   */
  private isNVDAvailable(): boolean {
    // 在生产环境中可配置为环境变量控制
    // 默认开启，可通过 NVD_DISABLED=true 禁用
    if (process.env.NVD_DISABLED === 'true') {
      return false;
    }
    return true;
  }

  /**
   * 构建搜索 URL
   */
  private buildSearchUrl(options: NVDSearchOptions): string {
    const params = new URLSearchParams();

    if (options.cveId) {
      params.set('cveId', options.cveId);
    } else if (options.cpeName) {
      params.set('cpeName', options.cpeName);
    } else if (options.keyword) {
      params.set('keywordSearch', options.keyword);
    } else {
      throw new OrionError('NVD search requires keyword, cpeName, or cveId', ErrorCode.VALIDATION_ERROR);
    }

    // 分页参数
    params.set('resultsPerPage', '20');
    params.set('startIndex', '0');

    return `${NVD_BASE_URL}?${params.toString()}`;
  }

  /**
   * 解析 NVD API 响应为内部格式
   */
  private parseNVDResponse(data: NVDResponse): NVDCVE[] {
    const cves: NVDCVE[] = [];

    for (const item of data.vulnerabilities) {
      const cve = item.cve;
      if (!cve || !cve.id) continue;

      const description = cve.descriptions?.find(d => d.lang === 'en')?.value
        || cve.descriptions?.[0]?.value
        || '';

      // 提取 CVSS 评分
      const cvssMetricV31 = cve.metrics?.cvssMetricV31?.[0];
      const cvssMetricV2 = cve.metrics?.cvssMetricV2?.[0];
      const cvssMetric = cvssMetricV31 || cvssMetricV2;
      const cvssScore = cvssMetric?.cvssData?.baseScore;
      const cvssSeverity = this.mapCVSSToSeverity(
        cvssMetricV31?.cvssData?.baseSeverity || cvssMetric?.cvssData?.baseScore,
      );

      // 提取 CPE 匹配信息
      const cpeMatch = cve.configurations?.flatMap(config =>
        config.nodes.flatMap(node =>
          node.cpeMatch.filter(match => match.vulnerable).map(match => ({
            cpeName: match.cpeName,
            versionStartIncluding: match.versionStartIncluding,
            versionEndExcluding: match.versionEndExcluding,
          }))
        )
      );

      // 提取固定版本（从 CPE 版本范围推断）
      let fixedVersion: string | undefined;
      if (cpeMatch && cpeMatch.length > 0) {
        const endExclusions = cpeMatch
          .map(m => m.versionEndExcluding)
          .filter((v): v is string => typeof v === 'string' && v.length > 0);
        if (endExclusions.length > 0) {
          fixedVersion = endExclusions[0];
        }
      }

      cves.push({
        id: cve.id,
        description,
        cvssScore,
        cvssSeverity,
        publishedDate: cve.published,
        lastModifiedDate: cve.lastModified,
        references: cve.references?.map(r => ({ url: r.url, source: r.source })) || [],
        cpeMatch: cpeMatch?.length ? cpeMatch : undefined,
        fixAvailable: !!fixedVersion,
        fixedVersion,
      });
    }

    return cves;
  }

  /**
   * 将 NVD CVSS 严重程度映射到内部 severity
   */
  private mapCVSSToSeverity(cvss?: string | number): NVDCVE['cvssSeverity'] {
    if (cvss === undefined || cvss === null) return 'none';
    const score = typeof cvss === 'string' ? parseFloat(cvss) : cvss;
    if (isNaN(score)) return 'none';
    if (score >= 9.0) return 'critical';
    if (score >= 7.0) return 'high';
    if (score >= 4.0) return 'medium';
    if (score >= 0.1) return 'low';
    return 'none';
  }

  /**
   * 获取缓存统计信息（用于调试和监控）
   */
  getCacheStats(): { size: number; entries: { key: string; ageMs: number; count: number }[] } {
    const entries: { key: string; ageMs: number; count: number }[] = [];
    const now = Date.now();

    for (const [key, entry] of cache.entries()) {
      entries.push({
        key,
        ageMs: now - entry.timestamp,
        count: entry.data.length,
      });
    }

    return { size: cache.size, entries };
  }

  /**
   * 清空缓存（测试用或管理操作）
   */
  clearCache(): void {
    cache.clear();
    logger.info({ tenantId: this.tenantId }, '[NVDClient] Cache cleared');
  }
}

export default NVDClient;
