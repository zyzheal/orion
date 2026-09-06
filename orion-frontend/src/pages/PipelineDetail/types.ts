/**
 * PipelineDetail - types
 * Pipeline 详情页类型定义
 *
 * 从 index.tsx 抽出，便于复用与单测。
 */

export interface PipelineStep {
  name: string;
  status: string;
  duration?: number;
  durationMs?: number | string;
  stageId?: string;
  stageName?: string;
  logs?: string[];
}

export interface PipelineStage {
  id?: string;
  name: string;
  status: string;
  type?: string;
  duration?: number | string;
  durationMs?: number | string;
  steps?: PipelineStep[];
  logs?: string[];
  startTime?: string;
  endTime?: string;
  dependsOn?: string[];
}

export interface PipelineDisplay {
  id: string;
  name: string;
  status: string;
  runNumber: number;
  branch: string;
  commit?: string;
  author?: string;
  trigger: string;
  startTime?: string;
  endTime?: string;
  duration?: number | string;
  stages: PipelineStage[];
}

export type StageFilterFn = (s: PipelineStage) => boolean;

/** Helper type for casting the backend run detail payload */
export type RunDetailPayload = Record<string, unknown> & {
  run?: Record<string, unknown>;
  stages?: unknown[];
  tasks?: unknown[];
};
