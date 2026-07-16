/**
 * CMDB Topology Repository - 拓扑数据访问层
 *
 * Provides optimized queries for CMDB topology operations using:
 * - Recursive CTEs for ancestor/descendant traversal
 * - Materialized path column for fast tree operations
 * - Covering indexes for common topology query patterns
 */

import { DatabasePool } from '../../services/database';
import { CI, CIRelation } from '../../services/cmdb/CmdbTypes';
import { TopologyNode, TopologyEdge, TopologyResponse, TopologyFilters } from '../../services/cmdb/TopologyService';

export interface TopologyTreeOptions {
  /** Maximum depth to traverse (default: 10, max: 50) */
  depth?: number;
  /** Filter by relation types (default: all) */
  relationTypes?: string[];
  /** Include CI details (default: true) */
  includeCiDetails?: boolean;
}

export interface AncestorResult {
  ci: CI;
  depth: number;
  relationType: string;
  path: string[];
}

export interface DescendantResult {
  ci: CI;
  depth: number;
  relationType: string;
  path: string[];
}

export interface PathResult {
  /** Sequence of CI IDs from source to target */
  path: string[];
  /** Sequence of relation types along the path */
  relationTypes: string[];
  /** Total hops */
  length: number;
}

export class CmdbTopologyRepository {
  private database: DatabasePool;

  constructor(database: DatabasePool) {
    this.database = database;
  }

  // ==================== Recursive CTE Queries ====================

  /**
   * Get all ancestors of a CI using recursive CTE.
   * Returns the chain of CIs from immediate parent up to root.
   *
   * Query pattern:
   *   WITH RECURSIVE ancestors AS (
   *     SELECT ... FROM cmdb_ci_relation WHERE to_ci_id = $1 AND tenant_id = $2
   *     UNION ALL
   *     SELECT ... FROM cmdb_ci_relation JOIN ancestors ...
   *   )
   */
  async getAncestors(tenantId: bigint, ciId: string, maxDepth: number = 50): Promise<AncestorResult[]> {
    const query = `
      WITH RECURSIVE ancestors AS (
        -- Anchor: direct parents of the starting CI
        SELECT
          r.from_ci_id   AS ci_id,
          r.relation_type,
          1              AS depth,
          ARRAY[r.from_ci_id] AS path_ci_ids,
          ARRAY[r.relation_type] AS path_relation_types
        FROM cmdb_ci_relation r
        WHERE r.to_ci_id = $1
          AND r.tenant_id = $2
          AND r.deleted_at IS NULL

        UNION ALL

        -- Recursive: find parents of already-found ancestors
        SELECT
          r.from_ci_id   AS ci_id,
          r.relation_type,
          a.depth + 1    AS depth,
          a.path_ci_ids || r.from_ci_id,
          a.path_relation_types || r.relation_type
        FROM cmdb_ci_relation r
        INNER JOIN ancestors a ON r.to_ci_id = a.ci_id
        WHERE r.tenant_id = $2
          AND r.deleted_at IS NULL
          AND a.depth < $3
      )
      SELECT
        a.ci_id,
        a.relation_type,
        a.depth,
        a.path_ci_ids,
        a.path_relation_types,
        ci.ci_id        AS ci_ci_id,
        ci.name         AS ci_name,
        ci.ci_type      AS ci_type,
        ci.status       AS ci_status,
        ci.environment  AS ci_environment,
        ci.tags         AS ci_tags,
        ci.attributes   AS ci_attributes
      FROM ancestors a
      LEFT JOIN cmdb_ci ci ON ci.ci_id = a.ci_id AND ci.deleted_at IS NULL
      ORDER BY a.depth DESC
    `;

    const result = await this.database.query(query, [ciId, tenantId.toString(), maxDepth]);
    return result.rows.map((row: any) => ({
      ci: this.mapRowToCI(row, 'ci_'),
      depth: row.depth,
      relationType: row.relation_type,
      path: row.path_ci_ids,
    }));
  }

  /**
   * Get all descendants of a CI using recursive CTE.
   * Returns the full subtree rooted at the given CI.
   */
  async getDescendants(tenantId: bigint, ciId: string, maxDepth: number = 50): Promise<DescendantResult[]> {
    const query = `
      WITH RECURSIVE descendants AS (
        -- Anchor: direct children of the starting CI
        SELECT
          r.to_ci_id     AS ci_id,
          r.relation_type,
          1              AS depth,
          ARRAY[r.to_ci_id] AS path_ci_ids,
          ARRAY[r.relation_type] AS path_relation_types
        FROM cmdb_ci_relation r
        WHERE r.from_ci_id = $1
          AND r.tenant_id = $2
          AND r.deleted_at IS NULL

        UNION ALL

        -- Recursive: find children of already-found descendants
        SELECT
          r.to_ci_id     AS ci_id,
          r.relation_type,
          d.depth + 1    AS depth,
          d.path_ci_ids || r.to_ci_id,
          d.path_relation_types || r.relation_type
        FROM cmdb_ci_relation r
        INNER JOIN descendants d ON r.from_ci_id = d.ci_id
        WHERE r.tenant_id = $2
          AND r.deleted_at IS NULL
          AND d.depth < $3
      )
      SELECT
        d.ci_id,
        d.relation_type,
        d.depth,
        d.path_ci_ids,
        d.path_relation_types,
        ci.ci_id        AS ci_ci_id,
        ci.name         AS ci_name,
        ci.ci_type      AS ci_type,
        ci.status       AS ci_status,
        ci.environment  AS ci_environment,
        ci.tags         AS ci_tags,
        ci.attributes   AS ci_attributes
      FROM descendants d
      LEFT JOIN cmdb_ci ci ON ci.ci_id = d.ci_id AND ci.deleted_at IS NULL
      ORDER BY d.depth ASC
    `;

    const result = await this.database.query(query, [ciId, tenantId.toString(), maxDepth]);
    return result.rows.map((row: any) => ({
      ci: this.mapRowToCI(row, 'ci_'),
      depth: row.depth,
      relationType: row.relation_type,
      path: row.path_ci_ids,
    }));
  }

  /**
   * Find the shortest path between two CIs using recursive CTE.
   * Returns the sequence of CIs and relations connecting source to target.
   */
  async getPath(tenantId: bigint, fromCiId: string, toCiId: string, maxDepth: number = 20): Promise<PathResult | null> {
    // Search forward from source
    const forwardQuery = `
      WITH RECURSIVE path_search AS (
        -- Anchor: start from source CI
        SELECT
          r.to_ci_id     AS ci_id,
          r.relation_type,
          1              AS depth,
          ARRAY[r.to_ci_id] AS ci_path,
          ARRAY[r.relation_type] AS rel_path
        FROM cmdb_ci_relation r
        WHERE r.from_ci_id = $1
          AND r.tenant_id = $2
          AND r.deleted_at IS NULL

        UNION ALL

        -- Recursive: follow outgoing relations
        SELECT
          r.to_ci_id     AS ci_id,
          r.relation_type,
          ps.depth + 1   AS depth,
          ps.ci_path || r.to_ci_id,
          ps.rel_path || r.relation_type
        FROM cmdb_ci_relation r
        INNER JOIN path_search ps ON r.from_ci_id = ps.ci_id
        WHERE r.tenant_id = $2
          AND r.deleted_at IS NULL
          AND ps.depth < $4
          AND NOT (r.to_ci_id = ANY(ps.ci_path))  -- prevent cycles
      )
      SELECT ci_path, rel_path, depth
      FROM path_search
      WHERE ci_id = $3
      ORDER BY depth ASC
      LIMIT 1
    `;

    const result = await this.database.query(forwardQuery, [
      fromCiId,
      tenantId.toString(),
      toCiId,
      maxDepth,
    ]);

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      path: [fromCiId, ...row.ci_path],
      relationTypes: row.rel_path,
      length: row.depth,
    };
  }

  // ==================== Batch / Tree Loading ====================

  /**
   * Load the full topology tree rooted at rootCiId in a single query.
   * Returns nodes and edges for the subtree up to the specified depth.
   */
  async loadTopology(
    tenantId: bigint,
    rootCiId: string,
    depth: number = 10
  ): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[] }> {
    // Single query to load all relations in the subtree via recursive CTE
    const relationsQuery = `
      WITH RECURSIVE subtree AS (
        -- Anchor: relations from root
        SELECT
          r.id,
          r.from_ci_id,
          r.to_ci_id,
          r.relation_type,
          r.description,
          1 AS rel_depth
        FROM cmdb_ci_relation r
        WHERE r.from_ci_id = $1
          AND r.tenant_id = $2
          AND r.deleted_at IS NULL

        UNION ALL

        -- Recursive: relations from descendants
        SELECT
          r.id,
          r.from_ci_id,
          r.to_ci_id,
          r.relation_type,
          r.description,
          s.rel_depth + 1
        FROM cmdb_ci_relation r
        INNER JOIN subtree s ON r.from_ci_id = s.to_ci_id
        WHERE r.tenant_id = $2
          AND r.deleted_at IS NULL
          AND s.rel_depth < $3
      )
      SELECT DISTINCT id, from_ci_id, to_ci_id, relation_type, description
      FROM subtree
    `;

    const relationsResult = await this.database.query(relationsQuery, [
      rootCiId,
      tenantId.toString(),
      depth,
    ]);

    // Collect unique CI IDs
    const ciIds = new Set<string>();
    ciIds.add(rootCiId);
    for (const row of relationsResult.rows) {
      ciIds.add(row.from_ci_id);
      ciIds.add(row.to_ci_id);
    }

    // Batch-load all CI details in a single query
    const cis = await this.loadCIsByIds(tenantId, Array.from(ciIds));

    // Build node map
    const nodeMap = new Map<string, TopologyNode>();
    for (const ci of cis) {
      nodeMap.set(ci.ciId, {
        id: ci.id,
        ciId: ci.ciId,
        type: ci.ciType,
        name: ci.name,
        status: ci.status,
        environment: ci.environment,
        metadata: {
          tags: ci.tags,
          attributes: ci.attributes,
        },
      });
    }

    // Build edges
    const edges: TopologyEdge[] = relationsResult.rows.map((row: any) => ({
      id: row.id,
      source: row.from_ci_id,
      target: row.to_ci_id,
      type: row.relation_type,
      description: row.description,
      metadata: {},
    }));

    // Ensure root node is included even if it has no outgoing relations
    if (!nodeMap.has(rootCiId)) {
      const rootCi = cis.find(c => c.ciId === rootCiId);
      if (rootCi) {
        nodeMap.set(rootCiId, {
          id: rootCi.id,
          ciId: rootCi.ciId,
          type: rootCi.ciType,
          name: rootCi.name,
          status: rootCi.status,
          environment: rootCi.environment,
        });
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }

  /**
   * Batch-load multiple topologies in one round-trip.
   * Efficient for dashboard views showing multiple CI trees.
   */
  async loadMultipleTopologies(
    tenantId: bigint,
    rootCiIds: string[],
    depth: number = 10
  ): Promise<Map<string, { nodes: TopologyNode[]; edges: TopologyEdge[] }>> {
    if (rootCiIds.length === 0) {
      return new Map();
    }

    // Load all relations for all root CIs in a single query
    const relationsQuery = `
      WITH RECURSIVE all_subtrees AS (
        SELECT
          r.id,
          r.from_ci_id,
          r.to_ci_id,
          r.relation_type,
          r.description,
          r.from_ci_id AS root_ci_id,
          1 AS rel_depth
        FROM cmdb_ci_relation r
        WHERE r.from_ci_id = ANY($1::text[])
          AND r.tenant_id = $2
          AND r.deleted_at IS NULL

        UNION ALL

        SELECT
          r.id,
          r.from_ci_id,
          r.to_ci_id,
          r.relation_type,
          r.description,
          s.root_ci_id,
          s.rel_depth + 1
        FROM cmdb_ci_relation r
        INNER JOIN all_subtrees s ON r.from_ci_id = s.to_ci_id
        WHERE r.tenant_id = $2
          AND r.deleted_at IS NULL
          AND s.rel_depth < $3
      )
      SELECT DISTINCT id, from_ci_id, to_ci_id, relation_type, description, root_ci_id
      FROM all_subtrees
    `;

    const relationsResult = await this.database.query(relationsQuery, [
      rootCiIds,
      tenantId.toString(),
      depth,
    ]);

    // Collect unique CI IDs
    const ciIds = new Set<string>();
    for (const ciId of rootCiIds) {
      ciIds.add(ciId);
    }
    for (const row of relationsResult.rows) {
      ciIds.add(row.from_ci_id);
      ciIds.add(row.to_ci_id);
    }

    // Batch-load all CIs
    const cis = await this.loadCIsByIds(tenantId, Array.from(ciIds));
    const ciMap = new Map(cis.map(ci => [ci.ciId, ci]));

    // Group edges by root_ci_id and build result map
    const result = new Map<string, { nodes: TopologyNode[]; edges: TopologyEdge[] }>();

    for (const rootCiId of rootCiIds) {
      const rootEdges = relationsResult.rows.filter((r: any) => r.root_ci_id === rootCiId);
      const nodeSet = new Set<string>();
      nodeSet.add(rootCiId);

      for (const edge of rootEdges) {
        nodeSet.add(edge.from_ci_id);
        nodeSet.add(edge.to_ci_id);
      }

      const nodes: TopologyNode[] = [];
      for (const ciId of nodeSet) {
        const ci = ciMap.get(ciId);
        if (ci) {
          nodes.push({
            id: ci.id,
            ciId: ci.ciId,
            type: ci.ciType,
            name: ci.name,
            status: ci.status,
            environment: ci.environment,
            metadata: { tags: ci.tags, attributes: ci.attributes },
          });
        }
      }

      const edges: TopologyEdge[] = rootEdges.map((row: any) => ({
        id: row.id,
        source: row.from_ci_id,
        target: row.to_ci_id,
        type: row.relation_type,
        description: row.description,
        metadata: {},
      }));

      result.set(rootCiId, { nodes, edges });
    }

    return result;
  }

  // ==================== Impact Analysis ====================

  /**
   * Find all CIs that would be affected by a change to the given CI.
   * Uses recursive CTE to traverse "depends_on" relationships upstream.
   */
  async findAffectedCIs(tenantId: bigint, ciId: string, maxDepth: number = 10): Promise<CI[]> {
    const query = `
      WITH RECURSIVE affected AS (
        -- Anchor: direct dependents (CIs that depend on the given CI)
        SELECT
          r.from_ci_id AS ci_id,
          1            AS depth
        FROM cmdb_ci_relation r
        WHERE r.to_ci_id = $1
          AND r.tenant_id = $2
          AND r.relation_type = 'DEPENDS_ON'
          AND r.deleted_at IS NULL

        UNION ALL

        -- Recursive: find dependents of dependents
        SELECT
          r.from_ci_id AS ci_id,
          a.depth + 1  AS depth
        FROM cmdb_ci_relation r
        INNER JOIN affected a ON r.to_ci_id = a.ci_id
        WHERE r.tenant_id = $2
          AND r.relation_type = 'DEPENDS_ON'
          AND r.deleted_at IS NULL
          AND a.depth < $3
      )
      SELECT DISTINCT ci.ci_id, ci.name, ci.ci_type, ci.status, ci.environment,
                       ci.tags, ci.attributes, ci.created_at, ci.updated_at
      FROM affected a
      INNER JOIN cmdb_ci ci ON ci.ci_id = a.ci_id AND ci.deleted_at IS NULL
      ORDER BY a.depth ASC
    `;

    const result = await this.database.query(query, [ciId, tenantId.toString(), maxDepth]);
    return result.rows.map((row: any) => this.mapRowToCI(row));
  }

  /**
   * Find all CIs that would be affected by a change to the given CI.
   * Uses recursive CTE to traverse "depends_on" relationships upstream.
   * Returns both affected CIs and the edges connecting them.
   */
  async findAffectedCIsWithEdges(
    tenantId: bigint,
    ciId: string,
    maxDepth: number = 10
  ): Promise<{ cis: CI[]; edges: TopologyEdge[] }> {
    const query = `
      WITH RECURSIVE affected AS (
        -- Anchor: direct dependents (CIs that depend on the given CI)
        SELECT
          r.id,
          r.from_ci_id,
          r.to_ci_id,
          r.relation_type,
          1 AS depth
        FROM cmdb_ci_relation r
        WHERE r.to_ci_id = $1
          AND r.tenant_id = $2
          AND r.relation_type = 'DEPENDS_ON'
          AND r.deleted_at IS NULL

        UNION ALL

        -- Recursive: find dependents of dependents
        SELECT
          r.id,
          r.from_ci_id,
          r.to_ci_id,
          r.relation_type,
          a.depth + 1
        FROM cmdb_ci_relation r
        INNER JOIN affected a ON r.to_ci_id = a.from_ci_id
        WHERE r.tenant_id = $2
          AND r.relation_type = 'DEPENDS_ON'
          AND r.deleted_at IS NULL
          AND a.depth < $3
      )
      SELECT
        a.id,
        a.from_ci_id,
        a.to_ci_id,
        a.relation_type,
        ci.ci_id        AS ci_ci_id,
        ci.name         AS ci_name,
        ci.ci_type      AS ci_type,
        ci.status       AS ci_status,
        ci.environment  AS ci_environment,
        ci.tags         AS ci_tags,
        ci.attributes   AS ci_attributes
      FROM affected a
      INNER JOIN cmdb_ci ci ON ci.ci_id = a.from_ci_id AND ci.deleted_at IS NULL
      ORDER BY a.depth ASC
    `;

    const result = await this.database.query(query, [ciId, tenantId.toString(), maxDepth]);

    const cis: CI[] = [];
    const edges: TopologyEdge[] = [];
    const ciSet = new Set<string>();

    for (const row of result.rows) {
      // Add CI if not already added
      if (!ciSet.has(row.ci_ci_id)) {
        cis.push(this.mapRowToCI(row, 'ci_'));
        ciSet.add(row.ci_ci_id);
      }

      // Add edge
      edges.push({
        id: row.id,
        source: row.from_ci_id,
        target: row.to_ci_id,
        type: row.relation_type,
        description: '',
        metadata: {},
      });
    }

    return { cis, edges };
  }

  // ==================== CI Batch Loading ====================

  /**
   * Load multiple CIs by their ciIds in a single query.
   */
  async loadCIsByIds(tenantId: bigint, ciIds: string[]): Promise<CI[]> {
    if (ciIds.length === 0) {
      return [];
    }

    const query = `
      SELECT id, ci_id, tenant_id, ci_type, name, description, status,
             environment, tags, attributes, version, created_by, created_at, updated_at, deleted_at, archived_at
      FROM cmdb_ci
      WHERE ci_id = ANY($1::text[])
        AND tenant_id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [ciIds, tenantId.toString()]);
    return result.rows.map((row: any) => this.mapRowToCI(row));
  }

  /**
   * Load all CIs of a specific type for a tenant in a single query.
   */
  async loadCIsByType(tenantId: bigint, ciType: string): Promise<CI[]> {
    const query = `
      SELECT id, ci_id, tenant_id, ci_type, name, description, status,
             environment, tags, attributes, version, created_by, created_at, updated_at, deleted_at, archived_at
      FROM cmdb_ci
      WHERE ci_type = $1
        AND tenant_id = $2
        AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [ciType, tenantId.toString()]);
    return result.rows.map((row: any) => this.mapRowToCI(row));
  }

  /**
   * Load all relations for a tenant in a single query.
   * Used for full-graph topology queries without a root CI.
   */
  async loadAllRelations(tenantId: bigint): Promise<CIRelation[]> {
    const query = `
      SELECT id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at, tenant_id, deleted_at
      FROM cmdb_ci_relation
      WHERE tenant_id = $1
        AND deleted_at IS NULL
    `;

    const result = await this.database.query(query, [tenantId.toString()]);
    return result.rows.map((row: any) => this.mapRowToRelation(row));
  }

  /**
   * Load the full topology graph for a tenant without requiring a root CI.
   * Returns all nodes and edges in the tenant's CMDB.
   * Optionally filters by ciType.
   */
  async loadAllTopology(
    tenantId: bigint,
    ciType?: string
  ): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[] }> {
    // Step 1: Load all relations for the tenant
    const relations = await this.loadAllRelations(tenantId);

    // Step 2: Collect unique CI IDs
    const ciIds = new Set<string>();
    for (const rel of relations) {
      ciIds.add(rel.fromCiId);
      ciIds.add(rel.toCiId);
    }

    // Step 3: Load CI details
    let cis: CI[];
    if (ciType) {
      // Filter by ciType first, then filter relations
      const typeFilteredCis = await this.loadCIsByType(tenantId, ciType);
      const typeFilteredIds = new Set(typeFilteredCis.map(c => c.ciId));
      const filteredRelations = relations.filter(
        r => typeFilteredIds.has(r.fromCiId) && typeFilteredIds.has(r.toCiId)
      );

      // Rebuild ciIds from filtered relations
      ciIds.clear();
      for (const rel of filteredRelations) {
        ciIds.add(rel.fromCiId);
        ciIds.add(rel.toCiId);
      }
      cis = typeFilteredCis.filter(c => ciIds.has(c.ciId));

      return {
        nodes: cis.map(ci => ({
          id: ci.id,
          ciId: ci.ciId,
          type: ci.ciType,
          name: ci.name,
          status: ci.status,
          environment: ci.environment,
          metadata: { tags: ci.tags, attributes: ci.attributes },
        })),
        edges: filteredRelations.map(rel => ({
          id: rel.id,
          source: rel.fromCiId,
          target: rel.toCiId,
          type: rel.relationType,
          description: rel.description,
          metadata: {},
        })),
      };
    }

    cis = await this.loadCIsByIds(tenantId, Array.from(ciIds));

    return {
      nodes: cis.map(ci => ({
        id: ci.id,
        ciId: ci.ciId,
        type: ci.ciType,
        name: ci.name,
        status: ci.status,
        environment: ci.environment,
        metadata: { tags: ci.tags, attributes: ci.attributes },
      })),
      edges: relations.map(rel => ({
        id: rel.id,
        source: rel.fromCiId,
        target: rel.toCiId,
        type: rel.relationType,
        description: rel.description,
        metadata: {},
      })),
    };
  }

  // ==================== Materialized Path Helpers ====================

  /**
   * Get descendants using the materialized path column (faster than recursive CTE
   * when the path column is maintained by triggers).
   *
   * Path format: '{ancestor1}.{ancestor2}.{ciId}'
   */
  async getDescendantsByPath(tenantId: bigint, ciId: string): Promise<CIRelation[]> {
    const query = `
      SELECT id, from_ci_id, to_ci_id, relation_type, description, created_by, created_at, tenant_id
      FROM cmdb_ci_relation
      WHERE tenant_id = $1
        AND path LIKE $2 || '.%'
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    const result = await this.database.query(query, [tenantId.toString(), ciId]);
    return result.rows.map((row: any) => this.mapRowToRelation(row));
  }

  /**
   * Update the materialized path for a relation.
   * Called after relation creation to maintain the path column.
   */
  async updateRelationPath(relationId: string, path: string): Promise<void> {
    const query = `
      UPDATE cmdb_ci_relation
      SET path = $1
      WHERE id = $2
    `;

    await this.database.query(query, [path, relationId]);
  }

  /**
   * Rebuild paths for all relations under a given root CI.
   * Used after batch operations to ensure path consistency.
   */
  async rebuildPaths(tenantId: bigint, rootCiId: string): Promise<void> {
    // Get all descendants
    const descendants = await this.getDescendants(tenantId, rootCiId, 50);

    // Update paths: path = '{ancestor}.{ciId}'
    for (const desc of descendants) {
      const pathPrefix = desc.path.length > 0 ? desc.path.join('.') + '.' : '';
      const newPath = pathPrefix + desc.ci.ciId;

      // Find relations where this CI is the target (incoming to this CI from ancestor)
      const updateQuery = `
        UPDATE cmdb_ci_relation
        SET path = $1
        WHERE to_ci_id = $2
          AND tenant_id = $3
          AND deleted_at IS NULL
      `;

      await this.database.query(updateQuery, [newPath, desc.ci.ciId, tenantId.toString()]);
    }
  }

  // ==================== Private Helpers ====================

  /**
   * Map a database row to a CI object.
   * Supports column name prefixes (e.g., 'ci_' for joined queries).
   */
  private mapRowToCI(row: any, prefix: string = ''): CI {
    return {
      id: row[prefix + 'id'] || row.id,
      ciId: row[prefix + 'ci_id'] || row.ci_id,
      tenantId: BigInt(row[prefix + 'tenant_id'] || row.tenant_id),
      ciType: row[prefix + 'ci_type'] || row.ci_type,
      name: row[prefix + 'name'] || row.name,
      description: row[prefix + 'description'] || row.description,
      status: (row[prefix + 'status'] || row.status) as any,
      environment: row[prefix + 'environment'] || row.environment,
      tags: row[prefix + 'tags'] || row.tags || [],
      attributes: row[prefix + 'attributes'] || row.attributes || {},
      version: row[prefix + 'version'] || row.version || 1,
      createdBy: row[prefix + 'created_by'] || row.created_by,
      createdAt: new Date(row[prefix + 'created_at'] || row.created_at),
      updatedAt: new Date(row[prefix + 'updated_at'] || row.updated_at),
      deletedAt: row[prefix + 'deleted_at'] ? new Date(row[prefix + 'deleted_at']) : undefined,
      archivedAt: row[prefix + 'archived_at'] ? new Date(row[prefix + 'archived_at']) : undefined,
    };
  }

  /**
   * Map a database row to a CIRelation object.
   */
  private mapRowToRelation(row: any): CIRelation {
    return {
      id: row.id,
      fromCiId: row.from_ci_id,
      toCiId: row.to_ci_id,
      relationType: row.relation_type,
      description: row.description,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }
}
