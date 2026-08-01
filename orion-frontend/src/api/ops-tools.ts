/**
 * Ops Tools API Client
 *
 * 系统管理与运维工具 API 客户端，涵盖：
 * - 定时任务 (CronJob)
 * - 数据库工具 (SQL Dump / 碎片分析 / 索引管理)
 * - MQ 监控
 * - Tagent 管理
 * - 批量操作
 * - 文件管理
 * - 系统配置 (主题/许可证/模块)
 * - 线程池状态
 * - 审计/日志
 */
import { api } from './client';

const BASE = '/api/v1/ops-tools';

// ==================== 类型定义 ====================

export interface SystemInfo {
  platformVersion: string;
  uptime: string;
  totalCronJobs: number;
  enabledCronJobs: number;
  totalTagentClients: number;
  onlineTagentClients: number;
  totalFiles: number;
  mqQueueCount: number;
  totalModules: number;
}

// 定时任务
export interface CronJob {
  id: string;
  name: string;
  cronExpression: string;
  command: string;
  description: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  status: 'idle' | 'running' | 'error';
  createdAt: string;
  updatedAt: string;
}

// SQL Dump
export interface SqlDumpResult {
  id: string;
  filename: string;
  size: string;
  status: 'success' | 'running' | 'failed';
  message?: string;
  createdAt: string;
}

// 数据库碎片
export interface DatabaseFragment {
  id: string;
  databaseName: string;
  tableName: string;
  totalSize: string;
  fragmentSize: string;
  fragmentRate: number;
  suggestedAction: string;
  createdAt: string;
}

// 索引
export interface IndexInfo {
  id: string;
  tableName: string;
  indexName: string;
  columns: string[];
  size: string;
  usageCount: number;
  status: 'active' | 'unused' | 'redundant';
  createdAt: string;
}

// MQ 队列
export interface MQQueue {
  name: string;
  type: 'rabbitmq' | 'kafka' | 'redis';
  messageCount: number;
  consumerCount: number;
  status: 'healthy' | 'warning' | 'critical';
  lastActiveAt?: string;
  deadLetters?: number;
}

// Tagent 客户端
export interface TagentClient {
  id: string;
  hostname: string;
  ip: string;
  version: string;
  status: 'online' | 'offline' | 'upgrading';
  os: string;
  lastHeartbeat: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  createdAt: string;
}

export interface TagentStats {
  total: number;
  online: number;
  offline: number;
  upgrading: number;
}

// 批量操作
export interface BatchOperation {
  id: string;
  command: string;
  targetHosts: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

// 文件
export interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  mime: string;
  targetHosts?: string[];
  status: 'uploaded' | 'distributing' | 'distributed' | 'failed';
  createdAt: string;
}

// 主题
export interface ThemeConfig {
  id: string;
  name: string;
  primaryColor: string;
  borderRadius: number;
  mode: 'light' | 'dark';
  enabled: boolean;
}

// 许可证
export interface LicenseInfo {
  id: string;
  productName: string;
  licenseKey: string;
  type: 'enterprise' | 'standard' | 'community';
  seats: number;
  usedSeats: number;
  expireAt: string;
  status: 'active' | 'expired' | 'grace';
}

// 系统模块
export interface SystemModule {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  dependencies: string[];
}

// 线程池
export interface ThreadPool {
  name: string;
  coreSize: number;
  maxSize: number;
  activeCount: number;
  queueSize: number;
  completedTasks: number;
  status: 'normal' | 'busy' | 'saturated';
}

// 审计
export interface AuditEvent {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  ip: string;
  timestamp: string;
}

// 日志
export interface LogEntry {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  service: string;
  message: string;
  timestamp: string;
}

// ==================== System Info ====================
// Note: the interceptor auto-unwraps { success, data: T } => T, so generic
// is the final payload shape, NOT double-wrapped with { data: ... }.

export function getSystemInfo() {
  return api.get<SystemInfo>(`${BASE}/info`);
}

// ==================== CronJob ====================

export function getCronJobs() {
  return api.get<CronJob[]>(`${BASE}/cron-jobs`);
}

export function getCronJob(id: string) {
  return api.get<CronJob>(`${BASE}/cron-jobs/${id}`);
}

export function createCronJob(data: { name: string; cronExpression: string; command: string; description: string }) {
  return api.post<CronJob>(`${BASE}/cron-jobs`, data);
}

export function updateCronJob(id: string, data: Partial<CronJob>) {
  return api.put<CronJob>(`${BASE}/cron-jobs/${id}`, data);
}

export function deleteCronJob(id: string) {
  return api.delete(`${BASE}/cron-jobs/${id}`);
}

export function toggleCronJob(id: string, enabled: boolean) {
  return api.post<CronJob>(`${BASE}/cron-jobs/${id}/toggle`, { enabled });
}

// ==================== Database Tools ====================

export function executeSqlDump() {
  return api.post<SqlDumpResult>(`${BASE}/db/sql-dump`);
}

export function getSqlDumps() {
  return api.get<SqlDumpResult[]>(`${BASE}/db/sql-dumps`);
}

export function getDatabaseFragments(tableName?: string) {
  const params = tableName ? { tableName } : undefined;
  return api.get<DatabaseFragment[]>(`${BASE}/db/fragments`, { params });
}

export function getIndexes() {
  return api.get<IndexInfo[]>(`${BASE}/db/indexes`);
}

export function createIndex(data: { tableName: string; indexName: string; columns: string[] }) {
  return api.post<IndexInfo>(`${BASE}/db/indexes`, data);
}

export function deleteIndex(id: string) {
  return api.delete(`${BASE}/db/indexes/${id}`);
}

// ==================== MQ ====================

export function getMQQueues() {
  return api.get<MQQueue[]>(`${BASE}/mq/queues`);
}

// ==================== Tagent ====================

// Backend returns { data: TagentClient[], stats: TagentStats } at the
// top-level payload; the interceptor unwraps the outer ApiResponse, so
// res.data === { data, stats } after the call.
export interface TagentListResponse {
  data: TagentClient[];
  stats: TagentStats;
}

export function getTagentClients() {
  return api.get<TagentListResponse>(`${BASE}/tagent`);
}

export function getTagentClient(id: string) {
  return api.get<TagentClient>(`${BASE}/tagent/${id}`);
}

export function upgradeTagent(id: string, version: string) {
  return api.post<TagentClient>(`${BASE}/tagent/${id}/upgrade`, { version });
}

// ==================== Batch ====================

export function executeBatch(data: { command: string; targetHosts: string[] }) {
  return api.post<BatchOperation>(`${BASE}/batch`, data);
}

export function getBatchOperations() {
  return api.get<BatchOperation[]>(`${BASE}/batch`);
}

export function getBatchOperation(id: string) {
  return api.get<BatchOperation>(`${BASE}/batch/${id}`);
}

// ==================== Files ====================

export function uploadFile(data: { name: string; size: number; mime?: string }) {
  return api.post<FileInfo>(`${BASE}/files`, data);
}

export function getFiles() {
  return api.get<FileInfo[]>(`${BASE}/files`);
}

export function distributeFile(id: string, targetHosts: string[]) {
  return api.post<FileInfo>(`${BASE}/files/${id}/distribute`, { targetHosts });
}

export function deleteFile(id: string) {
  return api.delete(`${BASE}/files/${id}`);
}

// ==================== Themes ====================

export function getThemes() {
  return api.get<ThemeConfig[]>(`${BASE}/themes`);
}

export function createTheme(data: { name: string; primaryColor: string; borderRadius?: number; mode?: 'light' | 'dark' }) {
  return api.post<ThemeConfig>(`${BASE}/themes`, data);
}

export function updateTheme(id: string, data: Partial<ThemeConfig>) {
  return api.put<ThemeConfig>(`${BASE}/themes/${id}`, data);
}

export function deleteTheme(id: string) {
  return api.delete(`${BASE}/themes/${id}`);
}

// ==================== License ====================

export function getLicenses() {
  return api.get<LicenseInfo[]>(`${BASE}/licenses`);
}

// ==================== Modules ====================

export function getSystemModules() {
  return api.get<SystemModule[]>(`${BASE}/modules`);
}

export function toggleSystemModule(id: string, enabled: boolean) {
  return api.post<SystemModule>(`${BASE}/modules/${id}/toggle`, { enabled });
}

// ==================== Thread Pool ====================

export function getThreadPools() {
  return api.get<ThreadPool[]>(`${BASE}/thread-pools`);
}

// ==================== Audit ====================

// Backend payload: { events, total } after interceptor unwraps outer ApiResponse.
export interface AuditResponse {
  events: AuditEvent[];
  total: number;
}

export function getAuditEvents(page: number = 1, limit: number = 50) {
  return api.get<AuditResponse>(`${BASE}/audit`, { params: { page, limit } });
}

// ==================== Logs ====================

export interface LogResponse {
  logs: LogEntry[];
  total: number;
}

export function getLogs(params?: { level?: string; service?: string; page?: number; limit?: number }) {
  return api.get<LogResponse>(`${BASE}/logs`, { params });
}
