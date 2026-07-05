/**
 * Pipeline API Service
 * Pipeline CRUD operations and execution management
 */
import { api } from './client';

export interface Pipeline {
  id: string;
  name: string;
  version: string | number;
  description?: string;
  yamlDefinition?: string;
  status: 'active' | 'inactive' | 'deleted';
  spec?: {
    stages: Array<{
      name: string;
      type: string;
      timeout?: number;
      retryCount?: number;
      dependsOn?: string[];
      config?: Record<string, any>;
    }>;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName: string;
  name?: string;
  runNumber: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  trigger: 'manual' | 'push' | 'schedule' | 'api';
  branch: string;
  commit?: string;
  author: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  stages?: Array<{
    name: string;
    status: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
    steps?: Array<{
      name: string;
      status: string;
      duration?: number;
    }>;
    logs?: string[];
  }>;
}

export interface PipelineListParams {
  name?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface PipelineRunListParams {
  status?: string;
  branch?: string;
  trigger?: string;
  page?: number;
  pageSize?: number;
}

export interface CacheConfig {
  enabled: boolean;
  key: string;
  paths: string[];
  restoreKeys?: string[];
}

export interface ArtifactConfig {
  upload?: string[];
  expiry?: number;
}

export interface CreatePipelineInput {
  name: string;
  version: string;
  description?: string;
  yamlDefinition: string;
}

export interface UpdatePipelineInput {
  yamlDefinition?: string;
  description?: string;
  status?: string;
}

export interface StageInput {
  name: string;
  type: string;
  timeout?: number;
  retryCount?: number;
  dependsOn?: string[];
  cache?: CacheConfig;
  artifacts?: ArtifactConfig;
  config?: Record<string, any>;
}

// ---- Pipeline CRUD ----

export function getPipelines(params?: PipelineListParams) {
  return api.get('/api/v1/pipelines', { params });
}

export function getPipeline(id: string) {
  return api.get(`/api/v1/pipelines/${id}`);
}

export function createPipeline(data: CreatePipelineInput) {
  return api.post('/api/v1/pipelines', data);
}

export function updatePipeline(id: string, data: UpdatePipelineInput) {
  return api.put(`/api/v1/pipelines/${id}`, data);
}

export function deletePipeline(id: string) {
  return api.delete(`/api/v1/pipelines/${id}`);
}

export function getPipelineVersions(name: string) {
  return api.get(`/api/v1/pipelines/versions/${name}`);
}

export function validatePipelineYaml(yamlDefinition: string) {
  return api.post('/api/v1/pipelines/validate', { yamlDefinition });
}

// ---- Pipeline Execution ----

export function triggerPipeline(
  id: string,
  data?: { branch?: string; variables?: Record<string, string> }
) {
  return api.post(`/api/v1/pipelines/${id}/runs`, data);
}

export function getPipelineRuns(pipelineId: string, params?: PipelineRunListParams) {
  return api.get(`/api/v1/pipeline-runs`, { params: { pipelineId, ...params } });
}

export function getPipelineRun(runId: string) {
  return api.get(`/api/v1/pipeline-runs/${runId}`);
}

export function cancelPipelineRun(runId: string) {
  return api.post(`/api/v1/pipeline-runs/${runId}/cancel`);
}

export function retryPipelineRun(runId: string) {
  return api.post(`/api/v1/pipeline-runs/${runId}/retry`);
}

// ---- Cache Management ----

export function saveCache(runId: string, stageId: string, data: { key: string; paths: string[] }) {
  return api.post(`/api/v1/pipeline-runs/${runId}/stages/${stageId}/cache`, data);
}

export function restoreCache(runId: string, stageId: string, key: string) {
  return api.get(`/api/v1/pipeline-runs/${runId}/stages/${stageId}/cache`, { params: { key } });
}

// Note: Build cache management is under /build-cache, not /caches
export function deleteCache(_cacheKey: string) {
  // Backend uses /build-cache/entries/:id for cache entry deletion
  console.warn('deleteCache: use build-cache endpoints under /api/v1/build-cache instead');
  return Promise.resolve();
}

export function listCaches(_params?: { stageName?: string }) {
  // Backend uses /build-cache/configs and /build-cache/entries
  console.warn('listCaches: use build-cache endpoints under /api/v1/build-cache instead');
  return Promise.resolve({ data: [] });
}

// ---- Artifact Management ----

export function uploadArtifact(runId: string, stageId: string, data: FormData) {
  return api.post(`/api/v1/pipeline-runs/${runId}/stages/${stageId}/artifacts`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function downloadArtifact(artifactId: string) {
  return api.get(`/api/v1/artifacts/${artifactId}/download`, { responseType: 'blob' });
}

export function listArtifacts(params?: { runId?: string; stageId?: string }) {
  return api.get('/api/v1/artifacts', { params });
}

export function deleteArtifact(artifactId: string) {
  return api.delete(`/api/v1/artifacts/${artifactId}`);
}

// ---- Pipeline Error Detail ----

export function batchUpdatePipelines(
  ids: string[],
  action: 'activate' | 'deactivate' | 'delete'
) {
  return api.post('/api/v1/pipelines/batch', {
    ids,
    action,
  });
}

export interface PipelineErrorDetailResponse {
  errorType:
    | 'compilation_error'
    | 'test_failure'
    | 'deployment_failure'
    | 'infrastructure_error'
    | 'timeout_error'
    | 'configuration_error'
    | 'unknown_error';
  severity: 'critical' | 'warning' | 'info';
  humanReadableMessage: string;
  suggestedFix: string[];
  rawError: string;
  stageName: string;
  timestamp: string;
  classification?: {
    type: string;
    shouldRetry: boolean;
    retryStrategy: string;
    confidence: number;
    reasoning: string;
  };
}

/**
 * Get structured error detail for a failed pipeline run.
 * Maps to GET /api/v1/pipelines/:runId/error-detail
 */
export function getPipelineErrorDetail(runId: string) {
  return api.get<{ data: PipelineErrorDetailResponse }>(
    `/api/v1/pipelines/${runId}/error-detail`
  );
}
