/**
 * Change Request RFC Approval API
 * Phase 2 - ITSM change management with multi-level approval chain
 */
import apiClient from './client';

export interface ChangeRequest {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  changeType: 'standard' | 'normal' | 'emergency';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactScope: 'minor' | 'major' | 'significant' | null;
  rollbackPlan: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'implementing' | 'completed' | 'cancelled';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeApproval {
  id: string;
  tenantId: string;
  changeRequestId: string;
  approverRole: 'supervisor' | 'manager' | 'cto';
  approverId: string | null;
  approvalOrder: number;
  status: 'pending' | 'approved' | 'rejected';
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface ChangeExecution {
  id: string;
  tenantId: string;
  changeRequestId: string;
  stepOrder: number;
  stepName: string;
  stepType: 'manual' | 'script' | 'automated';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  output: string | null;
  error: string | null;
  executedBy: string | null;
  createdAt: string;
}

export interface CreateChangeRequestInput {
  title: string;
  description?: string;
  changeType: 'standard' | 'normal' | 'emergency';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  impactScope?: 'minor' | 'major' | 'significant';
  rollbackPlan?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface UpdateChangeRequestInput {
  title?: string;
  description?: string;
  changeType?: 'standard' | 'normal' | 'emergency';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  impactScope?: 'minor' | 'major' | 'significant';
  rollbackPlan?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

// Change Requests
export const listChangeRequests = (params?: { status?: string; changeType?: string }) =>
  apiClient.get<ChangeRequest[]>('/change-requests', { params });

export const getChangeRequest = (id: string) =>
  apiClient.get<ChangeRequest>(`/change-requests/${id}`);

export const createChangeRequest = (data: CreateChangeRequestInput) =>
  apiClient.post<ChangeRequest>('/change-requests', data);

export const updateChangeRequest = (id: string, data: UpdateChangeRequestInput) =>
  apiClient.put<ChangeRequest>(`/change-requests/${id}`, data);

export const deleteChangeRequest = (id: string) =>
  apiClient.delete(`/change-requests/${id}`);

export const submitForApproval = (id: string) =>
  apiClient.post<ChangeRequest>(`/change-requests/${id}/submit`);

// Approvals
export const getApprovalChain = (changeRequestId: string) =>
  apiClient.get<ChangeApproval[]>(`/change-requests/${changeRequestId}/approvals`);

export const approveChange = (changeRequestId: string, approvalId: string, comment?: string) =>
  apiClient.post(`/change-requests/${changeRequestId}/approvals/${approvalId}/approve`, { comment });

export const rejectChange = (changeRequestId: string, approvalId: string, comment?: string) =>
  apiClient.post(`/change-requests/${changeRequestId}/approvals/${approvalId}/reject`, { comment });

// Execution
export const startExecution = (changeRequestId: string) =>
  apiClient.post(`/change-requests/${changeRequestId}/execution/start`);

export const getExecutionProgress = (changeRequestId: string) =>
  apiClient.get<ChangeExecution[]>(`/change-requests/${changeRequestId}/execution`);

export const updateExecutionStep = (stepId: string, data: { status: string; output?: string; error?: string }) =>
  apiClient.put(`/change-requests/execution/${stepId}`, data);
