/**
 * Approval Workflow API Service
 * Multi-level approval workflow management (M33)
 */
import { api } from './client';

// ---- Types ----

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalComment {
  userId: string;
  comment: string;
  action: 'approved' | 'rejected';
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  description?: string;
  requesterId: string;
  approverIds: string[];
  status: ApprovalStatus;
  approvals: string[];
  rejections: string[];
  requiredApprovals: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  comments?: ApprovalComment[];
}

export interface CreateApprovalInput {
  title: string;
  description?: string;
  requesterId: string;
  approverIds: string[];
  requiredApprovals?: number;
  metadata?: Record<string, unknown>;
}

export interface ApproveRejectInput {
  userId: string;
  comment?: string;
}

export interface ApprovalListResponse {
  approvals: ApprovalRequest[];
}

// ---- CRUD ----

/**
 * Get all pending approvals
 */
export function getApprovals() {
  return api.get<ApprovalListResponse>('/api/v1/approvals');
}

/**
 * Get a single approval request by ID
 */
export function getApproval(id: string) {
  return api.get<ApprovalRequest>(`/api/v1/approvals/${id}`);
}

/**
 * Create a new approval request
 */
export function createApproval(data: CreateApprovalInput) {
  return api.post<ApprovalRequest>('/api/v1/approvals', data);
}

/**
 * Approve an approval request
 */
export function approveApproval(id: string, data: ApproveRejectInput) {
  return api.post<ApprovalRequest>(`/api/v1/approvals/${id}/approve`, data);
}

/**
 * Reject an approval request
 */
export function rejectApproval(id: string, data: ApproveRejectInput) {
  return api.post<ApprovalRequest>(`/api/v1/approvals/${id}/reject`, data);
}
