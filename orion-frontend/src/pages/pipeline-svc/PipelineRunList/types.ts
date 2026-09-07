/**
 * PipelineRunList shared types
 * 抽取自 index.tsx (P2-9 Phase 140)
 */
import dayjs from 'dayjs';

export type DateRange = [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;

export interface StageRetryState {
  visible: boolean;
  runId: string | null;
}

export type Filters = Record<string, string | string[] | undefined>;

export interface RetryOptions {
  fromStage?: string;
  onlyFailed?: boolean;
}
