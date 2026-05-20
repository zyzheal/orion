/**
 * Workflow Dependency Analysis API Service
 * 工作流依赖分析 - 循环依赖检测与可视化
 */
import { api } from './client';

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
 * 依赖图分析结果
 */
export interface DependencyGraphResult {
  /** 是否安全（无循环依赖） */
  isSafe: boolean;
  /** 总定义数 */
  totalDefinitions: number;
  /** 总依赖边数 */
  totalEdges: number;
  /** 检测到的循环依赖列表 */
  cycles: CircularDependencyPath[];
}

/**
 * 单个工作流检查结果
 */
export interface DefinitionCheckResult {
  /** 工作流定义 ID */
  definitionId: string;
  /** 是否安全（无循环依赖） */
  isSafe: boolean;
  /** 直接依赖的子流程 ID 列表 */
  dependencies: string[];
  /** 检测到的循环依赖列表 */
  cycles: CircularDependencyPath[];
}

/**
 * 可视化节点
 */
export interface VisualizationNode {
  /** 节点 ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 是否在循环中 */
  inCycle: boolean;
}

/**
 * 可视化边
 */
export interface VisualizationEdge {
  /** 源节点 ID */
  source: string;
  /** 目标节点 ID */
  target: string;
}

/**
 * 可视化数据
 */
export interface VisualizationData {
  /** 节点列表 */
  nodes: VisualizationNode[];
  /** 边列表 */
  edges: VisualizationEdge[];
  /** 循环依赖列表 */
  cycles: CircularDependencyPath[];
}

// ---- API Methods ----

/**
 * 获取完整的依赖图和循环检测结果
 */
export function getDependencyGraph() {
  return api.get<DependencyGraphResult>('/v1/workflow-dependencies/graph');
}

/**
 * 检查单个工作流定义的循环依赖
 */
export function checkDefinition(definitionId: string) {
  return api.get<DefinitionCheckResult>(`/v1/workflow-dependencies/check/${definitionId}`);
}

/**
 * 获取依赖关系可视化数据
 */
export function getVisualizationData() {
  return api.get<VisualizationData>('/v1/workflow-dependencies/visualization');
}