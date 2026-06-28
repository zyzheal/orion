/**
 * Visor Exec API - 批量命令执行、定时任务、文件上传
 *
 * 2026-05-20: 新增，对接 orion-platform-service visor exec 路由
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface ExecCommandInput {
  command: string;
  hostIds: string[];
  timeout?: number;
}

export interface ExecCommandResponse {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  hostCount: number;
  createdAt: string;
}

export interface ExecLogDetail {
  id: string;
  commandId: string;
  hostname: string;
  output: string;
  errorOutput: string;
  exitCode: number;
  status: 'success' | 'failed' | 'running';
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
  category?: string;
}

export interface CronJob {
  id: string;
  name: string;
  command: string;
  hostIds: string[];
  hostnames: string[];
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

export interface CreateCronJobInput {
  name: string;
  command: string;
  hostIds: string[];
  cronExpression: string;
  enabled?: boolean;
}

export interface UploadTask {
  id: string;
  fileName: string;
  fileSize: number;
  hostIds: string[];
  hostnames: string[];
  targetPath: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  progress: number;
  createdAt: string;
}

// ============================================================================
// Command Execution
// ============================================================================

export function executeCommand(data: ExecCommandInput) {
  return api.post('/v1/visor/exec/command', data);
}

export function getCommandLog(id: string) {
  return api.get(`/v1/visor/exec/command-log/${id}`);
}

export function getCommandLogDetails(id: string) {
  return api.get(`/v1/visor/exec/command-log/${id}/details`);
}

export function listCommandLogs(page = 1, pageSize = 20) {
  return api.get('/v1/visor/exec/command-log', { params: { page, pageSize } });
}

// ============================================================================
// Script Templates
// ============================================================================

export function listTemplates() {
  return api.get('/v1/visor/exec/template');
}

export function getTemplate(id: string) {
  return api.get(`/v1/visor/exec/template/${id}`);
}

export function createTemplate(data: CreateTemplateInput) {
  return api.post('/v1/visor/exec/template', data);
}

export function updateTemplate(id: string, data: Partial<CreateTemplateInput>) {
  return api.put(`/v1/visor/exec/template/${id}`, data);
}

export function deleteTemplate(id: string) {
  return api.delete(`/v1/visor/exec/template/${id}`);
}

// ============================================================================
// Cron Jobs
// ============================================================================

export function listCronJobs() {
  return api.get('/v1/visor/exec/job');
}

export function getCronJob(id: string) {
  return api.get(`/v1/visor/exec/job/${id}`);
}

export function createCronJob(data: CreateCronJobInput) {
  return api.post('/v1/visor/exec/job', data);
}

export function updateCronJob(id: string, data: Partial<CreateCronJobInput>) {
  return api.put(`/v1/visor/exec/job/${id}`, data);
}

export function deleteCronJob(id: string) {
  return api.delete(`/v1/visor/exec/job/${id}`);
}

export function toggleCronJob(id: string, enabled: boolean) {
  return api.patch(`/v1/visor/exec/job/${id}/toggle`, { enabled });
}

export function runCronJobNow(id: string) {
  return api.post(`/v1/visor/exec/job/${id}/run-now`);
}

export function getCronJobLogs(id: string, page = 1, pageSize = 20) {
  return api.get(`/v1/visor/exec/job/${id}/logs`, { params: { page, pageSize } });
}

// ============================================================================
// File Upload
// ============================================================================

export function uploadFile(file: File, hostIds: string[], targetPath: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('hostIds', JSON.stringify(hostIds));
  formData.append('targetPath', targetPath);
  return api.post('/v1/visor/exec/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function listUploadTasks() {
  return api.get('/v1/visor/exec/upload-task');
}

export function getUploadTask(id: string) {
  return api.get(`/v1/visor/exec/upload-task/${id}`);
}

export function cancelUploadTask(id: string) {
  return api.post(`/v1/visor/exec/upload-task/${id}/cancel`);
}
