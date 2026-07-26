/** PluginAuditLog model */

export interface PluginAuditLog {
  id: string;
  taskId: string;
  pluginId: string;
  userId: string;
  tenantId: string;
  action: string;
  outcome: string;
  durationMs?: number;
  isolationTier?: string;
  approvalId?: string;
  codeHash?: string;
  permissions?: Record<string, any>;
  resultData?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
}

export interface CreatePluginAuditLog {
  taskId: string;
  pluginId: string;
  userId: string;
  tenantId: string;
  action: string;
  outcome: string;
  durationMs?: number;
  isolationTier?: string;
  approvalId?: string;
  codeHash?: string;
  permissions?: Record<string, any>;
  resultData?: Record<string, any>;
  errorMessage?: string;
}
