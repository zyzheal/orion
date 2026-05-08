/**
 * Plugin API Client
 *
 * Consolidated plugin API covering:
 * - Plugin Discovery (built-in, marketplace, enhanced)
 * - Inline Script (scan, dry-run, approval, AI generate)
 * - Observability (timeline, AI diagnose)
 */

import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export interface PluginAuditLog {
  id: string;
  action: string;
  pluginId: string;
  userId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ScanConfig {
  path?: string;
  patterns?: string[];
  language?: string;
}

export interface DryRunRequest {
  script: string;
  context?: Record<string, unknown>;
}

export interface ApprovalParams {
  title: string;
  description: string;
  approvers?: string[];
  metadata?: Record<string, unknown>;
}

export interface ApprovalStatus {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string;
  decidedAt?: string;
  comment?: string;
}

export interface TimelineData {
  timelines: unknown[];
  events: Record<string, unknown>;
}

export interface DiagnoseContext {
  runId?: string;
  error?: string;
  logs?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Plugin Discovery
// ============================================================================

/**
 * Get built-in plugins
 */
export function getBuiltInPlugins() {
  return api.get<ApiResponse>('/v1/plugins-spi');
}

/**
 * Search marketplace for plugins
 */
export function searchMarketplace(query: string) {
  return api.get<ApiResponse>(`/v1/plugins/marketplace`, {
    params: { query },
  });
}

/**
 * Get enhanced plugin details
 */
export function getEnhancedPlugin(pluginId: string) {
  return api.get<ApiResponse>(`/v1/plugins-enhanced/${pluginId}`);
}

/**
 * Install a plugin from marketplace
 */
export function installPlugin(pluginId: string, version: string) {
  return api.post<ApiResponse>(`/v1/plugins/marketplace/${pluginId}/install`, {
    version,
  });
}

/**
 * Uninstall a plugin
 */
export function uninstallPlugin(pluginId: string) {
  return api.delete<ApiResponse>(`/v1/plugins-enhanced/${pluginId}`);
}

/**
 * Get plugin audit logs
 */
export function getPluginAuditLogs(limit = 50) {
  return api.get<ApiResponse<{ logs: PluginAuditLog[] }>>(
    `/v1/plugins-enhanced/audit`,
    { params: { limit } }
  );
}

// ============================================================================
// Inline Script
// ============================================================================

/**
 * Scan code
 */
export function scanCode(config: ScanConfig) {
  return api.post<ApiResponse>('/v1/scripts/scan', { config });
}

/**
 * Dry run a script
 */
export function dryRun(req: DryRunRequest) {
  return api.post<ApiResponse>('/v1/scripts/dry-run', req);
}

/**
 * Request approval
 */
export function requestApproval(params: ApprovalParams) {
  return api.post<ApiResponse>('/v1/scripts/approval', params);
}

/**
 * Get approval status
 */
export function getApprovalStatus(approvalId: string) {
  return api.get<ApiResponse<ApprovalStatus>>(`/v1/scripts/approval/${approvalId}`);
}

/**
 * AI generate script
 */
export function aiGenerate(prompt: string) {
  return api.post<ApiResponse>('/v1/scripts/ai-generate', { prompt });
}

// ============================================================================
// Observability
// ============================================================================

/**
 * Get execution timeline
 */
export function getTimeline(runId: string) {
  return api.get<ApiResponse<TimelineData>>(
    `/v1/plugins-enhanced/${runId}/timeline`
  );
}

/**
 * AI diagnose
 */
export function aiDiagnose(context: DiagnoseContext) {
  return api.post<ApiResponse>('/v1/plugins-enhanced/ai-diagnose', { context });
}
