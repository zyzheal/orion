/**
 * Data Lineage API Client
 *
 * Endpoints for data lineage graph, nodes, edges, impact analysis.
 * Backend routes: /data-lineage/*
 */
import apiClient from './client';

// ==================== Types ====================

export interface LineageNode {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'sink' | 'dataset' | 'model';
  description?: string;
  pipelineId?: string;
  stageId?: string;
  schema?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface LineageEdge {
  id: string;
  from: string;
  to: string;
  relationship: 'produces' | 'consumes' | 'transforms' | 'derives';
  fieldMapping?: Record<string, string>;
}

export interface LineageGraph {
  tenantId: string;
  pipelineId?: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  generatedAt: string;
}

export interface LineageStats {
  totalNodes: number;
  totalEdges: number;
  sourceCount: number;
  transformCount: number;
  sinkCount: number;
  datasetCount: number;
  modelCount: number;
}

export interface LineageGraphResponse {
  graph: LineageGraph;
  stats: LineageStats;
}

export interface LineageRecord {
  id: string;
  tenantId: string;
  pipelineId: string;
  executionId: string;
  graph: LineageGraph;
  recordedAt: string;
}

export interface ImpactAnalysis {
  node?: LineageNode;
  upstreamCount: number;
  downstreamCount: number;
  affectedPipelines: string[];
}

// ==================== API Functions ====================

/**
 * Get full lineage graph with statistics
 */
export const getLineageGraph = async (): Promise<LineageGraphResponse> => {
  const response = await apiClient.get('/data-lineage/graph');
  return response.data as LineageGraphResponse;
};

/**
 * Get lineage graph for a specific pipeline
 */
export const getLineageByPipeline = async (pipelineId: string): Promise<LineageGraph> => {
  const response = await apiClient.get(`/data-lineage/graph/${pipelineId}`);
  return response.data as LineageGraph;
};

/**
 * Record lineage for a pipeline execution
 */
export const recordLineage = async (data: {
  pipelineId: string;
  executionId: string;
  nodes?: LineageNode[];
  edges?: LineageEdge[];
}): Promise<LineageRecord> => {
  const response = await apiClient.post('/data-lineage/record', data);
  return response.data as LineageRecord;
};

/**
 * Get lineage history for a pipeline
 */
export const getLineageHistory = async (
  pipelineId: string,
  limit?: number,
): Promise<LineageRecord[]> => {
  const response = await apiClient.get(`/data-lineage/history/${pipelineId}`, {
    params: limit ? { limit } : {},
  });
  return response.data as LineageRecord[];
};

/**
 * Add a lineage node
 */
export const addLineageNode = async (data: {
  id: string;
  name: string;
  type: LineageNode['type'];
  description?: string;
  pipelineId?: string;
  stageId?: string;
  schema?: Record<string, string>;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  await apiClient.post('/data-lineage/nodes', data);
};

/**
 * Add a lineage edge
 */
export const addLineageEdge = async (data: {
  id: string;
  from: string;
  to: string;
  relationship: LineageEdge['relationship'];
  fieldMapping?: Record<string, string>;
}): Promise<void> => {
  await apiClient.post('/data-lineage/edges', data);
};

/**
 * Get upstream nodes for a given node
 */
export const getUpstream = async (nodeId: string): Promise<LineageNode[]> => {
  const response = await apiClient.get(`/data-lineage/upstream/${nodeId}`);
  return response.data as LineageNode[];
};

/**
 * Get downstream nodes for a given node
 */
export const getDownstream = async (nodeId: string): Promise<LineageNode[]> => {
  const response = await apiClient.get(`/data-lineage/downstream/${nodeId}`);
  return response.data as LineageNode[];
};

/**
 * Impact analysis for a node
 */
export const getImpactAnalysis = async (nodeId: string): Promise<ImpactAnalysis> => {
  const response = await apiClient.get(`/data-lineage/impact/${nodeId}`);
  return response.data as ImpactAnalysis;
};
