/**
 * WorkflowDependencyAnalyzer - 工作流定义级循环依赖检测
 *
 * 分析所有工作流定义之间的 sub-workflow 调用关系，
 * 检测跨定义的循环依赖（A -> B -> C -> A）。
 *
 * 检测时机：
 * - 工作流定义创建/更新时自动检测
 * - 提供 API 手动触发全量检测
 */

import { WorkflowDefinitionRepository } from './WorkflowRepository';
import type { WorkflowDefinition, WorkflowNode, SubWorkflowNodeConfig } from './types';

const logger = require('pino')({ name: 'WorkflowDependencyAnalyzer' });

/**
 * 循环依赖路径
 */
export interface CircularDependencyPath {
  /** 循环路径中的工作流定义 ID 列表 */
  cycle: string[];
  /** 循环路径中的工作流名称 */
  names: string[];
  /** 循环长度 */
  length: number;
}

/**
 * 工作流依赖图
 */
export interface WorkflowDependencyGraph {
  /** 节点：工作流定义 ID -> 名称 */
  nodes: Map<string, string>;
  /** 边：工作流定义 ID -> 调用的子流程 ID 列表 */
  edges: Map<string, string[]>;
  /** 检测到的循环依赖 */
  cycles: CircularDependencyPath[];
}

/**
 * 依赖分析结果
 */
export interface DependencyAnalysisResult {
  /** 是否安全（无循环依赖） */
  isSafe: boolean;
  /** 循环依赖列表 */
  cycles: CircularDependencyPath[];
  /** 总定义数 */
  totalDefinitions: number;
  /** 总依赖边数 */
  totalEdges: number;
}

/**
 * 工作流定义级循环依赖分析器
 */
export class WorkflowDependencyAnalyzer {
  private definitionRepo: WorkflowDefinitionRepository;

  constructor(definitionRepo?: WorkflowDefinitionRepository) {
    this.definitionRepo = definitionRepo || new WorkflowDefinitionRepository();
  }

  /**
   * 构建完整的依赖图
   * 扫描所有工作流定义，提取 sub-workflow 调用关系
   */
  async buildDependencyGraph(): Promise<WorkflowDependencyGraph> {
    const definitions = await this.definitionRepo.findAll();
    const nodes = new Map<string, string>();
    const edges = new Map<string, string[]>();

    // 构建节点和边
    for (const def of definitions.entities) {
      nodes.set(def.id, def.name);

      const subWorkflowCalls: string[] = [];
      for (const node of def.nodes) {
        if (node.type === 'sub-workflow') {
          const config = node.config as SubWorkflowNodeConfig;
          if (config.subWorkflowId) {
            subWorkflowCalls.push(config.subWorkflowId);
          }
        }
      }

      edges.set(def.id, subWorkflowCalls);
    }

    // 检测循环
    const cycles = this.detectCycles(nodes, edges);

    return { nodes, edges, cycles };
  }

  /** 最大递归深度，防止栈溢出 */
  private static readonly MAX_RECURSION_DEPTH = 100;

  /**
   * 检测循环依赖
   * 使用 DFS + 颜色标记法检测所有循环
   */
  private detectCycles(
    nodes: Map<string, string>,
    edges: Map<string, string[]>
  ): CircularDependencyPath[] {
    const cycles: CircularDependencyPath[] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];

    const dfs = (nodeId: string, depth: number = 0) => {
      // 深度保护，防止栈溢出
      if (depth > WorkflowDependencyAnalyzer.MAX_RECURSION_DEPTH) {
        return;
      }

      if (inStack.has(nodeId)) {
        // 发现循环：从栈中找到循环起点
        const cycleStart = stack.indexOf(nodeId);
        if (cycleStart >= 0) {
          const cycle = stack.slice(cycleStart);
          const names = cycle.map((id) => nodes.get(id) || id);

          // 避免重复记录相同循环
          const cycleKey = [...cycle].sort().join(',');
          const isDuplicate = cycles.some(
            (c) => [...c.cycle].sort().join(',') === cycleKey
          );

          if (!isDuplicate) {
            cycles.push({
              cycle,
              names,
              length: cycle.length,
            });
          }
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      inStack.add(nodeId);
      stack.push(nodeId);

      const children = edges.get(nodeId) || [];
      for (const child of children) {
        dfs(child, depth + 1);
      }

      stack.pop();
      inStack.delete(nodeId);
    };

    // 对所有节点执行 DFS
    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * 全量分析所有工作流定义
   */
  async analyze(): Promise<DependencyAnalysisResult> {
    const graph = await this.buildDependencyGraph();

    let totalEdges = 0;
    for (const [, children] of graph.edges) {
      totalEdges += children.length;
    }

    return {
      isSafe: graph.cycles.length === 0,
      cycles: graph.cycles,
      totalDefinitions: graph.nodes.size,
      totalEdges,
    };
  }

  /**
   * 检查单个工作流定义是否存在循环依赖
   * 模拟将此定义加入现有依赖图，检查是否引入循环
   */
  async checkDefinition(definitionId: string): Promise<{
    isSafe: boolean;
    isValid: boolean;
    error?: string;
    cycles: CircularDependencyPath[];
    dependencies: string[];
  }> {
    const definition = await this.definitionRepo.findById(definitionId);
    if (!definition) {
      return { isSafe: false, isValid: false, error: 'Definition not found', cycles: [], dependencies: [] };
    }

    // 获取此定义直接调用的子流程
    const directDependencies: string[] = [];
    for (const node of definition.nodes) {
      if (node.type === 'sub-workflow') {
        const config = node.config as SubWorkflowNodeConfig;
        if (config.subWorkflowId) {
          directDependencies.push(config.subWorkflowId);
        }
      }
    }

    // 检查每个子流程是否间接调回此定义
    const cycles: CircularDependencyPath[] = [];

    for (const depId of directDependencies) {
      // 检查 depId 的依赖链是否最终回到 definitionId
      const chain = await this.getDependencyChain(depId, new Set([definitionId]));
      if (chain.includes(definitionId)) {
        // 发现循环
        const cycleStart = chain.indexOf(definitionId);
        const cycle = [definitionId, ...chain.slice(cycleStart)];
        const names = await this.getDefinitionNames(cycle);

        cycles.push({
          cycle,
          names,
          length: cycle.length,
        });
      }
    }

    return {
      isSafe: cycles.length === 0,
      isValid: cycles.length === 0,
      cycles,
      dependencies: directDependencies,
    };
  }

  /**
   * 获取从某个定义开始的依赖链
   * 用于检测是否最终回到起点
   */
  private async getDependencyChain(
    definitionId: string,
    visited: Set<string>,
    maxDepth: number = 20
  ): Promise<string[]> {
    if (visited.has(definitionId) || maxDepth <= 0) {
      return visited.has(definitionId) ? [definitionId] : [];
    }

    visited.add(definitionId);

    const definition = await this.definitionRepo.findById(definitionId);
    if (!definition) {
      return [];
    }

    // 获取此定义的所有子流程依赖
    for (const node of definition.nodes) {
      if (node.type === 'sub-workflow') {
        const config = node.config as SubWorkflowNodeConfig;
        if (config.subWorkflowId) {
          const subChain = await this.getDependencyChain(
            config.subWorkflowId,
            new Set(visited),
            maxDepth - 1
          );
          if (subChain.length > 0) {
            return [definitionId, ...subChain];
          }
        }
      }
    }

    return [definitionId];
  }

  /**
   * 获取一组定义 ID 对应的名称
   */
  private async getDefinitionNames(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];

    const nameMap = await this.definitionRepo.findByIds(ids);
    return ids.map((id) => nameMap.get(id) || id);
  }

  /**
   * 获取依赖关系可视化数据（用于前端展示）
   */
  async getVisualizationData(): Promise<{
    nodes: Array<{ id: string; name: string; inCycle: boolean }>;
    edges: Array<{ source: string; target: string }>;
    cycles: CircularDependencyPath[];
  }> {
    const graph = await this.buildDependencyGraph();

    const cycleNodeIds = new Set<string>();
    for (const cycle of graph.cycles) {
      for (const id of cycle.cycle) {
        cycleNodeIds.add(id);
      }
    }

    const nodes: Array<{ id: string; name: string; inCycle: boolean }> = [];
    for (const [id, name] of graph.nodes) {
      nodes.push({
        id,
        name,
        inCycle: cycleNodeIds.has(id),
      });
    }

    const edges: Array<{ source: string; target: string }> = [];
    for (const [sourceId, targets] of graph.edges) {
      for (const targetId of targets) {
        edges.push({ source: sourceId, target: targetId });
      }
    }

    return { nodes, edges, cycles: graph.cycles };
  }
}
