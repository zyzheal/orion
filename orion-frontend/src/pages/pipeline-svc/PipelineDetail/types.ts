/**
 * types.ts - PipelineDetail 领域类型
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 */
export interface StepDetail {
  name: string;
  status: string;
  duration?: number;
}

export interface StageDetail {
  name: string;
  id?: string;
  status: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  type?: string;
  dependsOn?: string[];
  steps?: StepDetail[];
  logs?: string[];
}

export interface PipelineDetailModel {
  id: string;
  name: string;
  runNumber: number;
  status: string;
  branch: string;
  commit?: string;
  version?: string;
  author?: string;
  trigger?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  stages?: StageDetail[];
  context?: Record<string, unknown>;
  pipelineVersion?: string;
}

export interface APIFlattenedResponse {
  run: Partial<PipelineDetailModel>;
  stages: StageDetail[];
}
