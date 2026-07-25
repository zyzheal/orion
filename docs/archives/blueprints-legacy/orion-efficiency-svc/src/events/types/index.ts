/**
 * Pipeline run event data types
 *
 * Stub for orion-platform-service events/types
 */

export interface PipelineRunEventData {
  runId: string;
  pipelineId: string;
  status: 'success' | 'failed' | 'running' | 'cancelled' | 'completed';
  triggerType: string;
  gitRef?: string;
  gitSha?: string;
  durationMs?: number;
  timestamp: string;
  tenantId?: string;
}
