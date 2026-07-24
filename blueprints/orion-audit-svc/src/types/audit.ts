export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'EXECUTE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'APPROVE'
  | 'REJECT'
  | 'REVIEW';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AuditStatus = 'pending' | 'verified' | 'tampered' | 'invalid';

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: Date;
  previousHash: string;
  currentHash: string;
  chainIndex: number;
  severity: AuditSeverity;
  status: AuditStatus;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogInput {
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: AuditSeverity;
  tenantId?: string | null;
}

export interface AuditChainInfo {
  genesisHash: string;
  latestHash: string;
  totalEntries: number;
  chainIntegrity: boolean;
  latestIndex: number;
  algorithm: string;
}

export interface AuditStorageStats {
  totalRecords: number;
  storageBytes: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  recordsByType: Record<string, number>;
}

export interface AuditLogQuery {
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditSeverity;
  status?: AuditStatus;
  tenantId?: string | null;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'chainIndex' | 'severity';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditActionResult {
  id: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  count: number;
}

export interface ResourceTypeCount {
  resourceType: string;
  count: number;
}
