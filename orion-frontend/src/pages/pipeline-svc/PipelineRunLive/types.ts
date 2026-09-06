/**
 * PipelineRunLive Types
 * Stage/Step/LogEntry interfaces + status type unions
 */

export type StageStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'warning';
export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface StepState {
  id: string;
  name: string;
  status: StepStatus;
  startTime?: string;
  endTime?: string;
}

export interface StageState {
  id: string;
  name: string;
  status: StageStatus;
  startTime?: string;
  endTime?: string;
  steps: StepState[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  stageName: string;
  stepName?: string;
  text: string;
  level: LogLevel;
}
