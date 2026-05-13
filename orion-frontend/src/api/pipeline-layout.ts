/**
 * Pipeline Layout API
 * Pipeline 可视化布局管理 - 用于 Canvas 拖拽编辑
 */
import apiClient from './client';

export interface PipelineLayout {
  id: string;
  pipelineId: string;
  layout: {
    nodes: LayoutNode[];
    edges: LayoutEdge[];
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  version: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutNode {
  id: string;
  stageId: string;
  type: 'stage';
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    stageType: string;
  };
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
}

export interface PipelineLayoutInput {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// Pipeline Layout API
export const pipelineLayoutApi = {
  // Get layout for pipeline
  get: async (pipelineId: string) => {
    const response = await apiClient.get(`/api/v1/pipelines/${pipelineId}/layouts`);
    return response.data as PipelineLayout;
  },

  // Save layout for pipeline
  save: async (pipelineId: string, layout: PipelineLayoutInput) => {
    const response = await apiClient.post(`/api/v1/pipelines/${pipelineId}/layouts`, { layout });
    return response.data as PipelineLayout;
  },

  // Update layout for pipeline
  update: async (pipelineId: string, layout: PipelineLayoutInput) => {
    const response = await apiClient.put(`/api/v1/pipelines/${pipelineId}/layouts`, { layout });
    return response.data as PipelineLayout;
  },

  // Delete layout for pipeline
  delete: async (pipelineId: string) => {
    const response = await apiClient.delete(`/api/v1/pipelines/${pipelineId}/layouts`);
    return response.data;
  },
};

export default pipelineLayoutApi;