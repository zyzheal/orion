/**
 * Topology Service - 拓扑服务
 *
 * 生成和管理 CMDB 资源拓扑关系
 */

import { CmdbService } from './CmdbService';
import { CmdbTopologyRepository } from '../../api/repositories/CmdbTopologyRepository';
import { CI, CIRelation, CiType } from './CmdbTypes';

export interface TopologyNode {
  id: string;
  ciId: string;
  type: string;
  name: string;
  status?: string;
  environment?: string;
  metadata?: Record<string, any>;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TopologyResponse {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface TopologyFilters {
  tenantId: bigint;
  ciType?: CiType;
  depth?: number;
  rootCiId?: string;
}

export class TopologyService {
  private cmdbService: CmdbService;
  private topologyRepository: CmdbTopologyRepository;

  constructor(
    cmdbService: CmdbService,
    topologyRepository?: CmdbTopologyRepository
  ) {
    this.cmdbService = cmdbService;
    this.topologyRepository = topologyRepository || new CmdbTopologyRepository(cmdbService as any);
  }

  /**
   * 获取拓扑图
   *
   * Optimization: Uses recursive CTE via CmdbTopologyRepository to avoid N+1 queries.
   * - If rootCiId + depth provided: single recursive CTE query
   * - Otherwise: batch-load all relations + CIs (2 queries instead of N+1)
   */
  async getTopology(filters: TopologyFilters): Promise<TopologyResponse> {
    const tenantId = filters.tenantId;

    // Use recursive CTE when root CI and depth are specified
    if (filters.rootCiId && filters.depth !== undefined) {
      const { nodes, edges } = await this.topologyRepository.loadTopology(
        tenantId,
        filters.rootCiId,
        filters.depth
      );
      return { nodes, edges };
    }

    // Full-graph topology: batch load all relations + CIs (no N+1)
    const { nodes, edges } = await this.topologyRepository.loadAllTopology(
      tenantId,
      filters.ciType
    );

    return { nodes, edges };
  }

  /**
   * 按深度过滤拓扑（BFS）
   * @deprecated Use loadTopology with rootCiId instead for better performance
   */
  private filterTopologyByDepth(
    nodes: TopologyNode[],
    edges: TopologyEdge[],
    rootCiId: string,
    maxDepth: number
  ): TopologyResponse {
    const nodeMap = new Map<string, TopologyNode>();
    const filteredNodes = new Set<string>();
    const filteredEdges: TopologyEdge[] = [];

    for (const node of nodes) {
      nodeMap.set(node.ciId, node);
    }

    const adjacencyList = new Map<string, { ciId: string; edge: TopologyEdge }[]>();
    for (const edge of edges) {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, []);
      }
      if (!adjacencyList.has(edge.target)) {
        adjacencyList.set(edge.target, []);
      }
      adjacencyList.get(edge.source)!.push({ ciId: edge.target, edge });
      adjacencyList.get(edge.target)!.push({ ciId: edge.source, edge: { ...edge, source: edge.target, target: edge.source } });
    }

    const queue: Array<{ ciId: string; depth: number }> = [{ ciId: rootCiId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { ciId, depth } = queue.shift()!;

      if (visited.has(ciId) || depth > maxDepth) {
        continue;
      }

      visited.add(ciId);
      filteredNodes.add(ciId);

      if (depth < maxDepth) {
        const neighbors = adjacencyList.get(ciId) || [];
        for (const { ciId: neighborCiId, edge } of neighbors) {
          if (!visited.has(neighborCiId)) {
            queue.push({ ciId: neighborCiId, depth: depth + 1 });
            if (!filteredEdges.find(e => e.id === edge.id)) {
              filteredEdges.push(edge);
            }
          }
        }
      }
    }

    const resultNodes = nodes.filter(node => filteredNodes.has(node.ciId));

    return {
      nodes: resultNodes,
      edges: filteredEdges,
    };
  }

  /**
   * 获取服务依赖链（下游依赖）
   * Uses recursive CTE for efficient tree traversal (no N+1).
   */
  async getServiceDependencies(
    tenantId: bigint,
    ciId: string,
    depth: number = 10
  ): Promise<TopologyResponse> {
    const ci = await this.cmdbService.getCIByCiId(ciId, tenantId);
    if (!ci) {
      return { nodes: [], edges: [] };
    }

    // Use recursive CTE to load full dependency tree in one query
    const { nodes, edges } = await this.topologyRepository.loadTopology(
      tenantId,
      ciId,
      depth
    );

    return { nodes, edges };
  }

  /**
   * 影响分析（故障传播路径 - 上游依赖）
   * Uses recursive CTE to find all CIs that depend on the given CI.
   */
  async getImpactAnalysis(
    tenantId: bigint,
    ciId: string,
    depth: number = 10
  ): Promise<{
    affectedNodes: TopologyNode[];
    affectedEdges: TopologyEdge[];
    impactLevel: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const ci = await this.cmdbService.getCIByCiId(ciId, tenantId);
    if (!ci) {
      return {
        affectedNodes: [],
        affectedEdges: [],
        impactLevel: 'low',
      };
    }

    // Use recursive CTE to find affected CIs and edges in one query
    const { cis, edges } = await this.topologyRepository.findAffectedCIsWithEdges(
      tenantId,
      ciId,
      depth
    );

    const affectedNodes: TopologyNode[] = cis.map(ci => ({
      id: ci.id,
      ciId: ci.ciId,
      type: ci.ciType,
      name: ci.name,
      status: ci.status,
      environment: ci.environment,
      metadata: { tags: ci.tags, attributes: ci.attributes },
    }));

    // Calculate impact level
    let impactLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (affectedNodes.length >= 10) {
      impactLevel = 'critical';
    } else if (affectedNodes.length >= 5) {
      impactLevel = 'high';
    } else if (affectedNodes.length >= 2) {
      impactLevel = 'medium';
    }

    return {
      affectedNodes,
      affectedEdges: edges,
      impactLevel,
    };
  }
}
