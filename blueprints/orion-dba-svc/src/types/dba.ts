export interface SqlOrder {
  id: string;
  tenantId: string;
  sourceId: string;
  sql: string;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  submittedBy: string;
  approvedBy?: string;
  executedBy?: string;
  submittedAt: string;
  approvedAt?: string;
  executedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface DataSource {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  type: 'mysql' | 'postgresql' | 'mariadb';
  status: 'active' | 'inactive' | 'error';
  lastChecked?: string;
}

export interface AuditRule {
  id: string;
  name: string;
  description?: string;
  rules: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPermission {
  userId: string;
  tenantId: string;
  dataSources: string[];
  roles: string[];
  canQuery: boolean;
  canExecute: boolean;
  canApprove: boolean;
}

export interface CreateOrderInput {
  sourceId: string;
  sql: string;
  reason?: string;
}

export interface ExecuteOrderInput {
  orderId: string;
  executedBy: string;
}

export interface DbaQuery {
  tenantId?: string;
  status?: string;
  page?: number;
  limit?: number;
}
