/**
 * Data Pipeline API Client
 * 对接后端 /data-pipeline 路由
 *
 * 后端端点（Go data-pipeline service）:
 * - GET    /data-pipeline          列表
 * - GET    /data-pipeline/:id      获取单个
 * - POST   /data-pipeline          创建
 * - PUT    /data-pipeline/:id      更新
 * - DELETE /data-pipeline/:id      删除
 * - POST   /data-pipeline/:id/run  运行
 * - PUT    /data-pipeline/:id/pause 暂停
 * - PUT    /data-pipeline/:id/resume 恢复
 * - GET    /data-pipeline/:id/status 状态
 * - GET    /data-pipeline/:id/logs 日志
 * - GET    /data-pipeline/schemas   列表模式
 * - GET    /data-pipeline/lineage/:id 血缘
 */
import apiClient from './client';

// ==================== 类型定义 ====================

export interface DataPipeline {
  id: string;
  name: string;
  description: string;
  sourceTable: string;
  targetTable: string;
  transformationScript: string;
  schedule: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'pending';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataPipelineRequest {
  name: string;
  description?: string;
  sourceTable?: string;
  targetTable?: string;
  transformationScript?: string;
  schedule?: string;
  status?: string;
}

export interface UpdateDataPipelineRequest extends CreateDataPipelineRequest {}

export interface PipelineStatus {
  status: 'running' | 'paused' | 'completed' | 'failed' | 'pending';
}

export interface PipelineLogs {
  logs: string[];
}

export interface PipelineSchemas {
  schemas: string[];
}

export interface PipelineLineage {
  lineage: Record<string, unknown>;
}

// ==================== API 方法 ====================

/**
 * 获取管道列表
 * @param params 分页和过滤参数
 */
export async function listDataPipelines(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const response = await apiClient.get('/data-pipeline', { params });
  // 后端返回 { data: [...], total: N }
  return response.data as { data: DataPipeline[]; total: number };
}

/**
 * 获取单个管道
 */
export async function getDataPipeline(id: string) {
  const response = await apiClient.get(`/data-pipeline/${id}`);
  return response.data as DataPipeline;
}

/**
 * 创建管道
 */
export async function createDataPipeline(data: CreateDataPipelineRequest) {
  const response = await apiClient.post('/data-pipeline', data);
  return response.data as DataPipeline;
}

/**
 * 更新管道
 */
export async function updateDataPipeline(id: string, data: UpdateDataPipelineRequest) {
  const response = await apiClient.put(`/data-pipeline/${id}`, data);
  return response.data as DataPipeline;
}

/**
 * 删除管道
 */
export async function deleteDataPipeline(id: string) {
  const response = await apiClient.delete(`/data-pipeline/${id}`);
  return response.data;
}

/**
 * 运行管道
 */
export async function runDataPipeline(id: string) {
  const response = await apiClient.post(`/data-pipeline/${id}/run`);
  return response.data;
}

/**
 * 暂停管道
 */
export async function pauseDataPipeline(id: string) {
  const response = await apiClient.put(`/data-pipeline/${id}/pause`);
  return response.data;
}

/**
 * 恢复管道
 */
export async function resumeDataPipeline(id: string) {
  const response = await apiClient.put(`/data-pipeline/${id}/resume`);
  return response.data;
}

/**
 * 获取管道状态
 */
export async function getDataPipelineStatus(id: string) {
  const response = await apiClient.get(`/data-pipeline/${id}/status`);
  return response.data as PipelineStatus;
}

/**
 * 获取管道日志
 */
export async function getDataPipelineLogs(id: string) {
  const response = await apiClient.get(`/data-pipeline/${id}/logs`);
  return response.data as PipelineLogs;
}

/**
 * 获取可用 Schema 列表
 */
export async function listDataPipelineSchemas() {
  const response = await apiClient.get('/data-pipeline/schemas');
  return response.data as PipelineSchemas;
}

/**
 * 获取管道数据血缘
 */
export async function getDataPipelineLineage(id: string) {
  const response = await apiClient.get(`/data-pipeline/lineage/${id}`);
  return response.data as PipelineLineage;
}

// 默认导出
export default {
  listDataPipelines,
  getDataPipeline,
  createDataPipeline,
  updateDataPipeline,
  deleteDataPipeline,
  runDataPipeline,
  pauseDataPipeline,
  resumeDataPipeline,
  getDataPipelineStatus,
  getDataPipelineLogs,
  listDataPipelineSchemas,
  getDataPipelineLineage,
};
