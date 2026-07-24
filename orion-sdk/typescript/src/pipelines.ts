import { ApiBase } from './client';

/**
 * Pipeline execution request
 */
export interface PipelineExecuteRequest {
  pipelineId: string;
  params?: Record<string, unknown>;
  wait?: boolean;
}

/**
 * Pipeline run response
 */
export interface PipelineRunResponse {
  runId: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  stages?: PipelineStage[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pipeline stage information
 */
export interface PipelineStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  error?: string;
}

/**
 * Pipeline log response
 */
export interface PipelineLogResponse {
  runId: string;
  logs: string[];
  totalLines: number;
  hasMore: boolean;
}

/**
 * Pipeline info
 */
export interface PipelineInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  stages: string[];
  triggers?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Pipeline API Module
 * Provides methods for interacting with Pipelines
 */
export class PipelineAPI extends ApiBase {
  /**
   * Execute a pipeline
   * @param pipelineId - The ID of the pipeline to execute
   * @param params - Optional parameters for the pipeline
   * @param wait - Whether to wait for completion (default: false)
   */
  async execute(
    pipelineId: string,
    params?: Record<string, unknown>,
    wait: boolean = false
  ): Promise<PipelineRunResponse> {
    return this.post<PipelineRunResponse>('/v1/pipelines/execute', {
      pipelineId,
      params,
      wait,
    });
  }

  /**
   * Get the status of a pipeline run
   * @param runId - The ID of the run
   */
  async getStatus(runId: string): Promise<PipelineRunResponse> {
    return this.get<PipelineRunResponse>(`/v1/pipelines/runs/${runId}/status`);
  }

  /**
   * List all available pipelines
   */
  async listPipelines(): Promise<PipelineInfo[]> {
    return this.get<PipelineInfo[]>('/v1/pipelines');
  }

  /**
   * Get a specific pipeline by ID
   * @param pipelineId - The ID of the pipeline
   */
  async getPipeline(pipelineId: string): Promise<PipelineInfo> {
    return this.get<PipelineInfo>(`/v1/pipelines/${pipelineId}`);
  }

  /**
   * Get logs for a pipeline run
   * @param runId - The ID of the run
   * @param offset - Line offset to start from (default: 0)
   */
  async getLogs(runId: string, offset: number = 0): Promise<PipelineLogResponse> {
    return this.get<PipelineLogResponse>(
      `/v1/pipelines/runs/${runId}/logs?offset=${offset}`
    );
  }

  /**
   * Cancel a running pipeline
   * @param runId - The ID of the run to cancel
   */
  async cancelRun(runId: string): Promise<void> {
    await this.post(`/v1/pipelines/runs/${runId}/cancel`);
  }

  /**
   * Get the result of a completed pipeline run
   * @param runId - The ID of the run
   */
  async getResult(runId: string): Promise<PipelineRunResponse> {
    return this.get<PipelineRunResponse>(`/v1/pipelines/runs/${runId}`);
  }

  /**
   * Create a new pipeline
   * @param pipeline - Pipeline configuration
   */
  async create(pipeline: Partial<PipelineInfo>): Promise<PipelineInfo> {
    return this.post<PipelineInfo>('/v1/pipelines', pipeline);
  }

  /**
   * Update an existing pipeline
   * @param pipelineId - The ID of the pipeline
   * @param pipeline - Updated pipeline configuration
   */
  async update(pipelineId: string, pipeline: Partial<PipelineInfo>): Promise<PipelineInfo> {
    return this.put<PipelineInfo>(`/v1/pipelines/${pipelineId}`, pipeline);
  }

  /**
   * Delete a pipeline
   * @param pipelineId - The ID of the pipeline to delete
   */
  async remove(pipelineId: string): Promise<void> {
    await this.delete(`/v1/pipelines/${pipelineId}`);
  }

  /**
   * Trigger a pipeline by name
   * @param name - The name of the pipeline
   * @param params - Optional parameters
   */
  async triggerByName(
    name: string,
    params?: Record<string, unknown>
  ): Promise<PipelineRunResponse> {
    return this.post<PipelineRunResponse>('/v1/pipelines/trigger', {
      name,
      params,
    });
  }
}