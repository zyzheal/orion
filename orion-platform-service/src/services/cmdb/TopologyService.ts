/**
 * Topology Service - 拓扑服务
 *
 * 生成和管理 CMDB 资源拓扑关系
 */

import { CmdbService } from './CmdbService';
import { CiType } from './CmdbTypes';

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

  constructor(cmdbService: CmdbService) {
    this.cmdbService = cmdbService;
  }

  /**
   * 获取拓扑图
   */
  async getTopology(filters: TopologyFilters): Promise<TopologyResponse> {
    // 获取所有 CI
    const cis = await this.cmdbService.listCIs({
      tenantId: filters.tenantId,
      ciType: filters.ciType,
      limit: 1000,
      offset: 0,
    });

    // 构建节点
    const nodes: TopologyNode[] = cis.data.map((ci) => ({
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
    }));

    // 构建边
    const edges: TopologyEdge[] = [];
    const edgeSet = new Set<string>();
    const processedRelations = new Set<string>();

    for (const ci of cis.data) {
      const relations = await this.cmdbService.getCIRelations(ci.ciId);
      for (const relation of relations) {
        // 避免重复处理同一个关系
        if (processedRelations.has(relation.id)) {
          continue;
        }
        processedRelations.add(relation.id);

        // 避免重复边
        const edgeKey = `${relation.fromCiId}-${relation.toCiId}-${relation.relationType}`;
        if (edgeSet.has(edgeKey)) {
          continue;
        }
        edgeSet.add(edgeKey);

        edges.push({
          id: relation.id,
          source: relation.fromCiId,
          target: relation.toCiId,
          type: relation.relationType,
          description: relation.description,
          metadata: {},
        });
      }
    }

    // 如果指定了 rootCiId，进行广度优先搜索限制深度
    if (filters.rootCiId && filters.depth !== undefined) {
      return this.filterTopologyByDepth(nodes, edges, filters.rootCiId, filters.depth);
    }

    return { nodes, edges };
  }

  /**
   * 按深度过滤拓扑
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

    // 构建节点映射
    for (const node of nodes) {
      nodeMap.set(node.ciId, node);
    }

    // 构建邻接表
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

    // BFS
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
            // 添加边（避免重复）
            if (!filteredEdges.find(e => e.id === edge.id)) {
              filteredEdges.push(edge);
            }
          }
        }
      }
    }

    // 过滤节点
    const resultNodes = nodes.filter(node => filteredNodes.has(node.ciId));

    return {
      nodes: resultNodes,
      edges: filteredEdges,
    };
  }

  /**
   * 获取服务依赖链
   */
  async getServiceDependencies(ciId: string): Promise<TopologyResponse> {
    const ci = await this.cmdbService.getCIByCiId(ciId);
    if (!ci) {
      return { nodes: [], edges: [] };
    }

    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];
    const visited = new Set<string>();

    // 递归获取依赖
    const collectDependencies = async (currentCiId: string, depth: number = 0) => {
      if (depth > 10 || visited.has(currentCiId)) {
        return;
      }
      visited.add(currentCiId);

      const currentCI = await this.cmdbService.getCIByCiId(currentCiId);
      if (!currentCI) {
        return;
      }

      nodes.push({
        id: currentCI.id,
        ciId: currentCI.ciId,
        type: currentCI.ciType,
        name: currentCI.name,
        status: currentCI.status,
        environment: currentCI.environment,
      });

      const relations = await this.cmdbService.getCIRelations(currentCiId);
      for (const relation of relations) {
        const isOutgoing = relation.fromCiId === currentCiId;
        const targetCiId = isOutgoing ? relation.toCiId : relation.fromCiId;

        edges.push({
          id: relation.id,
          source: relation.fromCiId,
          target: relation.toCiId,
          type: relation.relationType,
          description: relation.description,
        });

        await collectDependencies(targetCiId, depth + 1);
      }
    };

    await collectDependencies(ciId);

    return { nodes, edges };
  }

  /**
   * 影响分析（故障传播路径）
   */
  async getImpactAnalysis(ciId: string): Promise<{
    affectedNodes: TopologyNode[];
    affectedEdges: TopologyEdge[];
    impactLevel: 'critical' | 'high' | 'medium' | 'low';
  }> {
    const ci = await this.cmdbService.getCIByCiId(ciId);
    if (!ci) {
      return {
        affectedNodes: [],
        affectedEdges: [],
        impactLevel: 'low',
      };
    }

    // 获取所有依赖该资源的节点
    const affectedNodes: TopologyNode[] = [];
    const affectedEdges: TopologyEdge[] = [];
    const visited = new Set<string>();

    const collectDependents = async (currentCiId: string) => {
      if (visited.has(currentCiId)) {
        return;
      }
      visited.add(currentCiId);

      const relations = await this.cmdbService.getCIRelations(currentCiId);
      for (const relation of relations) {
        // 查找指向当前节点的关系（谁依赖我）
        if (relation.toCiId === currentCiId) {
          const sourceCI = await this.cmdbService.getCIByCiId(relation.fromCiId);
          if (sourceCI) {
            affectedNodes.push({
              id: sourceCI.id,
              ciId: sourceCI.ciId,
              type: sourceCI.ciType,
              name: sourceCI.name,
              status: sourceCI.status,
            });
            affectedEdges.push({
              id: relation.id,
              source: relation.fromCiId,
              target: relation.toCiId,
              type: relation.relationType,
            });
            await collectDependents(relation.fromCiId);
          }
        }
      }
    };

    await collectDependents(ciId);

    // 计算影响级别
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
      affectedEdges,
      impactLevel,
    };
  }
}
