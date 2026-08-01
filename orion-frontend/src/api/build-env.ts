/**
 * Build Environment API Service
 * Builder images, build cache, build pods, build logs, and artifacts management
 */
import { api } from './client';

// ---- Types ----

export interface BuilderImage {
  id: string;
  name: string;
  type: 'nodejs' | 'go' | 'java' | 'python' | 'custom';
  baseImage: string;
  version: string;
  status: 'active' | 'deprecated' | 'building';
  createdAt: string;
  updatedAt: string;
}

export interface BuildCacheConfig {
  id: string;
  name: string;
  pipeline: string;
  stage: string;
  strategy: 'volume' | 's3' | 'registry';
  paths: string[];
  ttlDays: number;
  enabled: boolean;
}

export interface BuildCacheEntry {
  id: string;
  configId: string;
  key: string;
  size: number;
  createdAt: string;
  lastAccessedAt: string;
}

export interface BuildPod {
  id: string;
  name: string;
  namespace: string;
  runId: string;
  stageId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface BuildLog {
  id: string;
  runId: string;
  stageId: string;
  podId: string;
  status: 'streaming' | 'completed' | 'failed';
  lineCount: number;
  createdAt: string;
}

export interface Artifact {
  id: string;
  name: string;
  type: string;
  size: number;
  pipelineRunId: string;
  stageId: string;
  downloadUrl?: string;
  expiresAt: string;
  createdAt: string;
}

// ---- Params ----

export interface BuilderImageListParams {
  type?: string;
  status?: string;
}

export interface BuilderImageInput {
  name: string;
  type: string;
  baseImage: string;
  version: string;
}

export interface UpdateBuilderImageInput {
  name?: string;
  baseImage?: string;
  version?: string;
  status?: string;
}

export interface BuildCacheConfigInput {
  name: string;
  pipeline: string;
  stage: string;
  strategy: 'volume' | 's3' | 'registry';
  paths: string[];
  ttlDays: number;
  enabled: boolean;
}

export interface BuildCacheEntryInput {
  configId: string;
  key: string;
  size: number;
}

export interface BuildPodListParams {
  runId?: string;
  stageId?: string;
  status?: string;
}

export interface BuildPodInput {
  name: string;
  namespace: string;
  runId: string;
  stageId: string;
}

export interface BuildLogListParams {
  runId?: string;
  stageId?: string;
}

export interface BuildLogInput {
  runId: string;
  stageId: string;
  podId: string;
}

export interface ArtifactListParams {
  pipelineRunId?: string;
  type?: string;
}

export interface ArtifactInput {
  name: string;
  type: string;
  size: number;
  pipelineRunId: string;
  stageId: string;
}

// ---- Builder Images ----

export function createBuilderImage(data: BuilderImageInput) {
  return api.post('/api/v1/build-images', data);
}

export function getBuilderImages(params?: BuilderImageListParams) {
  return api.get('/api/v1/build-images', { params });
}

export function getBuilderImagePresets() {
  return api.get('/api/v1/build-images/presets');
}

export function getBuilderImagesAvailable() {
  return api.get('/api/v1/build-images/available');
}

export function getBuilderImagesByType(type: string) {
  return api.get(`/api/v1/build-images/type/${type}`);
}

export function getBuilderImage(id: string) {
  return api.get(`/api/v1/build-images/${id}`);
}

export function updateBuilderImage(id: string, data: UpdateBuilderImageInput) {
  return api.put(`/api/v1/build-images/${id}`, data);
}

export function deleteBuilderImage(id: string) {
  return api.delete(`/api/v1/build-images/${id}`);
}

export function deprecateBuilderImage(id: string) {
  return api.post(`/api/v1/build-images/${id}/deprecate`);
}

export function restoreBuilderImage(id: string) {
  return api.post(`/api/v1/build-images/${id}/restore`);
}

// ---- Build Cache Configs ----

export function getBuildCacheConfigs() {
  return api.get('/api/v1/build-cache/configs');
}

export function createBuildCacheConfig(data: BuildCacheConfigInput) {
  return api.post('/api/v1/build-cache/configs', data);
}

export function getBuildCacheConfig(id: string) {
  return api.get(`/api/v1/build-cache/configs/${id}`);
}

export function updateBuildCacheConfig(id: string, data: Partial<BuildCacheConfigInput>) {
  return api.put(`/api/v1/build-cache/configs/${id}`, data);
}

export function deleteBuildCacheConfig(id: string) {
  return api.delete(`/api/v1/build-cache/configs/${id}`);
}

// ---- Build Cache Operations ----

export function getBuildCacheEffective() {
  return api.get('/api/v1/build-cache/effective');
}

export function getBuildCacheEnabled() {
  return api.get('/api/v1/build-cache/enabled');
}

export function getBuildCacheEntries() {
  return api.get('/api/v1/build-cache/entries');
}

export function createBuildCacheEntry(data: BuildCacheEntryInput) {
  return api.post('/api/v1/build-cache/entries', data);
}

export function deleteBuildCacheEntry(id: string) {
  return api.delete(`/api/v1/build-cache/entries/${id}`);
}

// ---- Build Cache Cleanup ----

export function cleanupExpiredCache() {
  return api.post('/api/v1/build-cache/cleanup/expired');
}

export function cleanupLRUCache(configId: string) {
  return api.post(`/api/v1/build-cache/cleanup/lru/${configId}`);
}

export function clearCacheConfig(configId: string) {
  return api.post(`/api/v1/build-cache/cleanup/clear/${configId}`);
}

// ---- Build Pods ----

export function getBuildPods(params?: BuildPodListParams) {
  return api.get('/api/v1/build-pods', { params });
}

export function createBuildPod(data: BuildPodInput) {
  return api.post('/api/v1/build-pods', data);
}

export function getBuildPod(id: string) {
  return api.get(`/api/v1/build-pods/${id}`);
}

export function getBuildPodLogs(id: string) {
  return api.get(`/api/v1/build-pods/${id}/logs`);
}

export function cleanupBuildPod(id: string) {
  return api.post(`/api/v1/build-pods/${id}/cleanup`);
}

export function cancelBuildPod(id: string) {
  return api.post(`/api/v1/build-pods/${id}/cancel`);
}

// ---- Build Logs ----

export function getBuildLogs(params?: BuildLogListParams) {
  return api.get('/api/v1/build-logs', { params });
}

export function getBuildLog(id: string) {
  return api.get(`/api/v1/build-logs/${id}`);
}

export function getBuildLogText(id: string) {
  return api.get(`/api/v1/build-logs/${id}/text`);
}

export function getBuildLogStreamUrl(id: string) {
  return `/api/v1/build-logs/${id}/stream`;
}

export function completeBuildLog(id: string) {
  return api.post(`/api/v1/build-logs/${id}/complete`);
}

// ---- Artifacts ----

export function getArtifacts(params?: ArtifactListParams) {
  return api.get('/api/v1/artifacts', { params });
}

export function createArtifact(data: ArtifactInput) {
  return api.post('/api/v1/artifacts', data);
}

export function getArtifact(id: string) {
  return api.get(`/api/v1/artifacts/${id}`);
}

export function downloadArtifact(id: string) {
  return api.get(`/api/v1/artifacts/${id}/download`, { responseType: 'blob' });
}

export function deleteArtifact(id: string) {
  return api.delete(`/api/v1/artifacts/${id}`);
}

export function cleanupExpiredArtifacts() {
  return api.post('/api/v1/artifacts/cleanup/expired');
}
