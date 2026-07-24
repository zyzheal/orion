/**
 * Plugin Audit Log 数据模型
 * 插件操作审计日志
 */

export interface PluginAuditLog {
  id: string;
  taskId: string;
  pluginId: string;
  userId: string;
  tenantId: string;
  action: 'execute' | 'install' | 'approve' | 'uninstall';
  outcome: 'success' | 'failed' | 'timeout' | 'cancelled';
  durationMs?: number;
  isolationTier?: string;
  approvalId?: string;
  codeHash?: string;
  permissions?: Record<string, unknown>;
  resultData?: Record<string, unknown>;
  errorMessage?: string;
  createdAt: Date;
}

export interface CreatePluginAuditLog {
  taskId: string;
  pluginId: string;
  userId: string;
  tenantId: string;
  action: PluginAuditLog['action'];
  outcome: PluginAuditLog['outcome'];
  durationMs?: number;
  isolationTier?: string;
  approvalId?: string;
  codeHash?: string;
  permissions?: Record<string, unknown>;
  resultData?: Record<string, unknown>;
  errorMessage?: string;
}
