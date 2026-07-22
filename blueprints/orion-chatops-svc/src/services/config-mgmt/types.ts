/**
 * Config Management Types - Stub
 */
export interface ConfigItem {
  id: string;
  key: string;
  value: string;
  namespace: string;
}

export type ConfigChangeStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ConfigChangeRequest {
  id: string;
  environmentId: string;
  key: string;
  oldValue: string;
  newValue: string;
  status: ConfigChangeStatus;
  createdBy: string;
  createdAt: Date;
}

export interface ApprovalRecord {
  id: string;
  changeRequestId: string;
  approverId: string;
  status: ApprovalStatus;
  comment?: string;
  createdAt: Date;
}

export interface ConfigEnvironment {
  id: string;
  name: string;
  description?: string;
  requiresApproval: boolean;
}
