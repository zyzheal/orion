export interface Runner {
  id: string;
  name: string;
  status: string;
  currentJobs: number;
  maxConcurrent: number;
  labels: string[];
  tenantId: string;
  url?: string;
  [key: string]: unknown;
}
export interface RunnerCreateInput { [key: string]: unknown; }
export interface RunnerUpdateInput { [key: string]: unknown; }
export interface RunnerEntity { id: string; [key: string]: unknown; }
export function isRunnerAvailable(r: Runner): boolean { return r.status === 'online' && r.currentJobs < r.maxConcurrent; }
export function isRunnerStale(_r: Runner, _timeoutMinutes?: number): boolean { return true; }
export function getRunnerUtilization(r: Runner): number { return r.maxConcurrent > 0 ? r.currentJobs / r.maxConcurrent : 1; }
