export interface SubPipelineInvocation {
  id: string;
  parentRunId: string;
  childPipelineId: string;
  childRunId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputParams: Record<string, string>;
  outputResults: Record<string, unknown>;
  stageName: string;
  outputMapping: Record<string, string>;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface SubPipelineInvocationCreateInput {
  parentRunId: string;
  childPipelineId: string;
  inputParams: Record<string, string>;
  stageName: string;
  outputMapping?: Record<string, string>;
}

export interface SubPipelineRecord {
  id?: string;
  parent_run_id?: string;
  child_pipeline_id?: string;
  child_run_id?: string;
  status?: string;
  input_params?: Record<string, string>;
  output_results?: Record<string, unknown>;
  stage_name?: string;
  output_mapping?: Record<string, string>;
  created_at?: string;
  completed_at?: string;
  error_message?: string;
}

export function createSubPipelineInvocation(input: SubPipelineInvocationCreateInput): SubPipelineInvocation {
  return {
    id: '',
    parentRunId: input.parentRunId,
    childPipelineId: input.childPipelineId,
    status: 'pending',
    inputParams: input.inputParams,
    outputResults: {},
    stageName: input.stageName,
    outputMapping: input.outputMapping || {},
    createdAt: new Date().toISOString(),
  };
}
export function startSubPipeline(inv: SubPipelineInvocation, childRunId?: string): SubPipelineInvocation {
  return { ...inv, status: 'running', childRunId };
}
export function completeSubPipeline(inv: SubPipelineInvocation, _results?: Record<string, unknown>): SubPipelineInvocation {
  return { ...inv, status: 'completed' };
}
export function failSubPipeline(inv: SubPipelineInvocation, error?: string): SubPipelineInvocation {
  return { ...inv, status: 'failed', error };
}
export function cancelSubPipeline(inv: SubPipelineInvocation): SubPipelineInvocation {
  return { ...inv, status: 'cancelled' };
}
