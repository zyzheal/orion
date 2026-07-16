/**
 * CMDB Topology Service - 拓扑服务（性能优化版）
 *
 * 提供高性能的 CMDB 拓扑查询能力：
 * - 使用 InMemoryCache 缓存拓扑树（TTL: 5 分钟）
 * - 批量加载多个拓扑树，减少 DB round-trips
 * - 基于 CmdbTopologyRepository 的递归 CTE 查询
 *
 * Task: 4.17 CMDB topology performance optimization
 */

import { CmdbService } from './CmdbService';
import { CmdbTopologyRepository } from '../../api/repositories/CmdbTopologyRepository';
import { InMemoryCache } from '../cache/InMemoryCache';
import { createLogger } from '../../utils/logger';
import { OrionError, ErrorCode } from '../../errors';
import { CI, CIRelation } from './CmdbTypes';
import { TopologyNode, TopologyEdge, TopologyResponse, TopologyFilters } from './TopologyService';

const logger = createLogger('cmdb-topology');

// Cache TTL: 5 minutes (topology changes are relatively infrequent)
const TOPOLOGY_CACHE_TTL_MS = 5 * 60 * 1000;

// Cache key prefix
const CACHE_KEY_PREFIX = 'cmdb:topology';

export interface TopologyTreeOptions {
  /** Maximum depth to traverse (default: 10) */
  depth?: number;
  /** Filter by relation types (default: all) */
  relationTypes?: string[];
  /** Force bypass cache (default: false) */
  bypassCache?: boolean;
}

export interface TopologyTreeResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  /** Root CI ID */
  rootCiId: string;
  /** Actual depth reached */
  depth: number;
  /** Whether result came from cache */
  cached?: boolean;
}

export class CmdbTopologyService {
  private cmdbService: CmdbService;
  private topologyRepository: CmdbTopologyRepository;
  private cache: InMemoryCache;

  constructor(
    cmdbService: CmdbService,
    topologyRepository?: CmdbTopologyRepository
  ) {
    this.cmdbService = cmdbService;
    this.topologyRepository = topologyRepository || new CmdbTopologyRepository(cmdbService as any);
    this.cache = new InMemoryCache({
      maxSize: 500,
      defaultTtlMs: TOPOLOGY_CACHE_TTL_MS,
    });
  }

  // ==================== Topology Tree (with caching) ====================

  /**
   * Get the full topology tree rooted at rootCiId.
   * Results are cached per tenant + root CI for 5 minutes.
   *
   * Cache invalidation:
   * - On CI create/update/delete
   * - On relation create/delete
   * - TTL expiry (5 minutes)
   */
  async getTopologyTree(
    tenantId: bigint,
    rootCiId: string,
    options: TopologyTreeOptions = {}
  ): Promise<TopologyTreeResult> {
    const depth = options.depth ?? 10;
    const bypassCache = options.bypassCache ?? false;

    // Build cache key: tenant_id:root_ci_id:depth
    const cacheKey = this.buildCacheKey(tenantId, rootCiId, depth);

    // Try cache first
    if (!bypassCache) {
      const cached = this.cache.get<TopologyTreeResult>(cacheKey);
      if (cached) {
        logger.debug({ tenantId, rootCiId, depth }, 'Topology tree served from cache');
        return { ...cached, cached: true };
      }
    }

    // Load from database
    const { nodes, edges } = await this.topologyRepository.loadTopology(
      tenantId,
      rootCiId,
      depth
    );

    const result: TopologyTreeResult = {
      nodes,
      edges,
      rootCiId,
      depth,
    };

    // Cache the result
    this.cache.set(cacheKey, result, TOPOLOGY_CACHE_TTL_MS);

    logger.debug(
      { tenantId, rootCiId, depth, nodeCount: nodes.length, edgeCount: edges.length },
      'Topology tree loaded from database'
    );

    return result;
  }

  // ==================== Ancestors ====================

  /**
   * Get all ancestors of a CI (upstream dependencies).
   * Uses recursive CTE for efficient tree traversal.
   *
   * Example: For CI "web-service" hosted_on "k8s-pod" hosted_on "vm-1"
   *   getAncestors returns: [vm-1 (depth=2), k8s-pod (depth=1)]
   */
  async getAncestors(tenantId: bigint, ciId: string, maxDepth: number = 50): Promise<AncestorResult> {
    // Resolve the CI first
    const ci = await this.cmdbService.getCIByCiId(ciId, tenantId);
    if (!ci) {
      throw new OrionError(`CI '${ciId}' not found`, ErrorCode.NOT_FOUND);
    }

    const ancestors = await this.topologyRepository.getAncestors(tenantId, ciId, maxDepth);

    return {
      ci,
      ancestors,
      maxDepth,
    };
  }

  // ==================== Descendants ====================

  /**
   * Get all descendants of a CI (downstream dependents).
   * Uses recursive CTE for efficient tree traversal.
   *
   * Example: For CI "database" with "web-app" and "api-service" depending on it
   *   getDescendants returns the full subtree
   */
  async getDescendants(tenantId: bigint, ciId: string, maxDepth: number = 50): Promise<DescendantResult> {
    // Resolve the CI first
    const ci = await this.cmdbService.getCIByCiId(ciId, tenantId);
    if (!ci) {
      throw new OrionError(`CI '${ciId}' not found`, ErrorCode.NOT_FOUND);
    }

    const descendants = await this.topologyRepository.getDescendants(tenantId, ciId, maxDepth);

    return {
      ci,
      descendants,
      maxDepth,
    };
  }

  // ==================== Path Finding ====================

  /**
   * Find the shortest path between two CIs.
   * Uses BFS via recursive CTE to find the shortest dependency chain.
   *
   * Example: findPath("service-a", "database-v1") might return:
   *   path: ["service-a", "service-b", "database-v1"]
   *   relationTypes: ["depends_on", "depends_on"]
   *   length: 2
   */
  async getPath(tenantId: bigint, fromCiId: string, toCiId: string): Promise<PathResult> {
    if (fromCiId === toCiId) {
      return {
        path: [fromCiId],
        relationTypes: [],
        length: 0,
      };
    }

    const result = await this.topologyRepository.getPath(tenantId, fromCiId, toCiId);

    if (!result) {
      throw new OrionError(
        `No path found between CI '${fromCiId}' and '${toCiId}'`,
        ErrorCode.NOT_FOUND
      );
    }

    return result;
  }

  // ==================== Impact Analysis ====================

  /**
   * Find all CIs that would be affected by a change to the given CI.
   * Traverses "DEPENDS_ON" relationships upstream to find dependents.
   *
   * Returns CIs ordered by distance from the source (closest first).
   */
  async findAffectedCis(tenantId: bigint, ciId: string, depth: number = 10): Promise<{
    cis: CI[];
    impactLevel: 'critical' | 'high' | 'medium' | 'low';
  }> {
    // Resolve the CI first
    const ci = await this.cmdbService.getCIByCiId(ciId, tenantId);
    if (!ci) {
      throw new OrionError(`CI '${ciId}' not found`, ErrorCode.NOT_FOUND);
    }

    const affectedCis = await this.topologyRepository.findAffectedCIs(tenantId, ciId, depth);

    // Calculate impact level
    let impactLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (affectedCis.length >= 10) {
      impactLevel = 'critical';
    } else if (affectedCis.length >= 5) {
      impactLevel = 'high';
    } else if (affectedCis.length >= 2) {
      impactLevel = 'medium';
    }

    logger.debug(
      { tenantId, ciId, affectedCount: affectedCis.length, impactLevel },
      'Impact analysis completed'
    );

    return {
      cis: affectedCis,
      impactLevel,
    };
  }

  // ==================== Batch Loading ====================

  /**
   * Load multiple topology trees in one batch.
   * More efficient than calling getTopologyTree multiple times.
   */
  async loadMultipleTopologies(
    tenantId: bigint,
    rootCiIds: string[],
    depth: number = 10
  ): Promise<Map<string, TopologyTreeResult>> {
    if (rootCiIds.length === 0) {
      return new Map();
    }

    // Try cache for each
    const results = new Map<string, TopologyTreeResult>();
    const toLoad: string[] = [];

    for (const rootCiId of rootCiIds) {
      const cacheKey = this.buildCacheKey(tenantId, rootCiId, depth);
      const cached = this.cache.get<TopologyTreeResult>(cacheKey);
      if (cached) {
        results.set(rootCiId, { ...cached, cached: true });
      } else {
        toLoad.push(rootCiId);
      }
    }

    // Batch load remaining from DB
    if (toLoad.length > 0) {
      const batchResults = await this.topologyRepository.loadMultipleTopologies(
        tenantId,
        toLoad,
        depth
      );

      for (const [rootCiId, tree] of batchResults) {
        const cacheKey = this.buildCacheKey(tenantId, rootCiId, depth);
        const result: TopologyTreeResult = {
          ...tree,
          rootCiId,
          depth,
        };
        this.cache.set(cacheKey, result, TOPOLOGY_CACHE_TTL_MS);
        results.set(rootCiId, result);
      }
    }

    return results;
  }

  // ==================== Cache Management ====================

  /**
   * Invalidate topology cache for a specific tenant.
   * Call this when CIs or relations are created/updated/deleted.
   */
  invalidateTenantCache(tenantId: bigint): void {
    const pattern = `${CACHE_KEY_PREFIX}:${tenantId}:*`;
    const deleted = this.cache.deleteByPattern(pattern);
    logger.debug({ tenantId, deletedCount: deleted }, 'Topology cache invalidated for tenant');
  }

  /**
   * Invalidate topology cache for a specific CI.
   * Call this when a specific CI's relations change.
   */
  invalidateCiCache(tenantId: bigint, ciId: string): void {
    const pattern = `${CACHE_KEY_PREFIX}:${tenantId}:*:${ciId}:*`;
    const deleted = this.cache.deleteByPattern(pattern);
    logger.debug({ tenantId, ciId, deletedCount: deleted }, 'Topology cache invalidated for CI');
  }

  /**
   * Clear all topology cache (use with caution).
   */
  clearCache(): void {
    const pattern = `${CACHE_KEY_PREFIX}:*`;
    const deleted = this.cache.deleteByPattern(pattern);
    logger.debug({ deletedCount: deleted }, 'All topology cache cleared');
  }

  /**
   * Get cache statistics for monitoring.
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  // ==================== Private Helpers ====================

  /**
   * Build cache key: cmdb:topology:{tenantId}:{rootCiId}:{depth}
   */
  private buildCacheKey(tenantId: bigint, rootCiId: string, depth: number): string {
    return `${CACHE_KEY_PREFIX}:${tenantId}:${rootCiId}:${depth}`;
  }
}

// ==================== Result Types ====================

export interface AncestorResult {
  ci: CI;
  ancestors: Array<{
    ci: CI;
    depth: number;
    relationType: string;
    path: string[];
  }>;
  maxDepth: number;
}

export interface DescendantResult {
  ci: CI;
  descendants: Array<{
    ci: CI;
    depth: number;
    relationType: string;
    path: string[];
  }>;
  maxDepth: number;
}

export interface PathResult {
  /** Sequence of CI IDs from source to target */
  path: string[];
  /** Sequence of relation types along the path */
  relationTypes: string[];
  /** Total hops */
  length: number;
}
