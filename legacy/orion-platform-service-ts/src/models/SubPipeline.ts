/**
 * SubPipelineInvocation 数据模型
 *
 * Tracks the invocation of a child pipeline as a sub-pipeline stage
 * within a parent pipeline run. Enables reusable workflow composition.
 */

import { v4 as uuidv4 } from 'uuid';

export type SubPipelineStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SubPipelineInvocation {
  id: string;
  parentRunId: string;
  childPipelineId: string;
  childRunId: string | null;
  status: SubPipelineStatus;
  inputParams: Record<string, string>;
  outputResults: Record<string, string>;
  stageName: string;
  outputMapping: Record<string, string>;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface SubPipelineInvocationCreateInput {
  parentRunId: string;
  childPipelineId: string;
  inputParams: Record<string, string>;
  stageName: string;
  outputMapping?: Record<string, string>;
}

/**
 * Create a new SubPipelineInvocation instance
 */
export function createSubPipelineInvocation(
  input: SubPipelineInvocationCreateInput
): SubPipelineInvocation {
  const now = new Date();
  return {
    id: uuidv4(),
    parentRunId: input.parentRunId,
    childPipelineId: input.childPipelineId,
    childRunId: null,
    status: 'pending',
    inputParams: input.inputParams,
    outputResults: {},
    stageName: input.stageName,
    outputMapping: input.outputMapping || {},
    createdAt: now,
  };
}

/**
 * Mark a sub-pipeline invocation as running
 */
export function startSubPipeline(invocation: SubPipelineInvocation, childRunId: string): SubPipelineInvocation {
  return {
    ...invocation,
    childRunId,
    status: 'running',
  };
}

/**
 * Mark a sub-pipeline invocation as completed with results
 */
export function completeSubPipeline(
  invocation: SubPipelineInvocation,
  results: Record<string, string>
): SubPipelineInvocation {
  return {
    ...invocation,
    status: 'completed',
    outputResults: results,
    completedAt: new Date(),
  };
}

/**
 * Mark a sub-pipeline invocation as failed
 */
export function failSubPipeline(
  invocation: SubPipelineInvocation,
  error: string
): SubPipelineInvocation {
  return {
    ...invocation,
    status: 'failed',
    error,
    completedAt: new Date(),
  };
}

/**
 * Mark a sub-pipeline invocation as cancelled
 */
export function cancelSubPipeline(invocation: SubPipelineInvocation): SubPipelineInvocation {
  return {
    ...invocation,
    status: 'cancelled',
    completedAt: new Date(),
  };
}
