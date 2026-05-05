export interface DataPipelineInput {
  name: string;
  description?: string;
  stages: PipelineStage[];
  schedule?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'extract' | 'transform' | 'load' | 'validate' | 'custom';
  config: Record<string, unknown>;
  dependsOn?: string[];
}

export interface DataPipeline {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'failed' | 'paused';
  schedule?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  tenantId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  stagesResults: StageResult[];
}

export interface StageResult {
  stageId: string;
  stageName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface DataLineageNode {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'sink';
  stageId?: string;
}

export interface DataLineageEdge {
  from: string;
  to: string;
  label?: string;
}

export interface DataLineage {
  pipelineId: string;
  nodes: DataLineageNode[];
  edges: DataLineageEdge[];
}
