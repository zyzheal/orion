/**
 * Pipeline Graph API Client
 *
 * 后端路由: /api/v1/pipelines/*
 * 模块: pipeline-graph-routes.ts
 */

import { api } from './client';

// ==================== Types ====================

export interface PipelineGraphNode {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
}

export interface PipelineGraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface PipelineGraph {
  pipelineId: string;
  pipelineName?: string;
  nodes: PipelineGraphNode[];
  edges: PipelineGraphEdge[];
}

export interface YamlParseResult {
  graph: PipelineGraph;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface YamlConvertResult {
  yaml: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ line?: number; message: string; rule?: string }>;
  warnings: Array<{ line?: number; message: string; rule?: string }>;
}

// ==================== API Methods ====================

/**
 * 从已保存的 Pipeline 构建 DAG 图
 * 后端直接返回 { pipelineId, pipelineName, graph }
 */
export async function getPipelineGraph(pipelineId: string): Promise<PipelineGraph> {
  const res = await api.get<{ pipelineId: string; pipelineName: string; graph: PipelineGraph }>(`/api/v1/pipelines/${encodeURIComponent(pipelineId)}/graph`);
  return res.data.graph;
}

/**
 * YAML 转 JSON 图格式
 * 后端直接返回 { graph, valid, errors, warnings }
 */
export async function parseYamlToGraph(yamlDefinition: string): Promise<YamlParseResult> {
  const res = await api.post<YamlParseResult>('/api/v1/pipelines/parse-yaml', {
    yamlDefinition,
  });
  return res.data;
}

/**
 * JSON 图转 YAML Pipeline 定义
 * 后端直接返回 { yaml, valid, errors, warnings }
 */
export async function convertGraphToYaml(graph: {
  pipelineId?: string;
  nodes: PipelineGraphNode[];
  edges: PipelineGraphEdge[];
}): Promise<YamlConvertResult> {
  const res = await api.post<YamlConvertResult>('/api/v1/pipelines/to-yaml', {
    graph,
  });
  return res.data;
}

/**
 * 验证 Pipeline YAML 定义
 * 后端直接返回 ValidationResult
 */
export async function validatePipelineYaml(yamlDefinition: string): Promise<ValidationResult> {
  const res = await api.post<ValidationResult>('/api/v1/pipelines/validate', {
    yamlDefinition,
  });
  return res.data;
}
