/**
 * VisualPipeline domain models
 *
 * Provides layout data model for visual pipeline editor
 */

export interface PipelineLayout {
  stages: StageLayout[];
  viewport: Viewport;
}

export interface StageLayout {
  stageId: string;
  position: Position;
  size: Size;
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface VisualPipeline {
  id: string;
  tenantId: string;
  pipelineId: string;
  name: string;
  layout: PipelineLayout;
  yamlDefinition: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VisualPipelineCreateInput {
  tenantId: string;
  pipelineId: string;
  name: string;
  layout?: PipelineLayout;
  yamlDefinition: string;
  createdBy?: string;
}

export interface VisualPipelineUpdateInput {
  name?: string;
  layout?: PipelineLayout;
  yamlDefinition?: string;
}

export interface VisualPipelineFilter {
  tenantId: string;
  pipelineId?: string;
  page?: number;
  limit?: number;
}