/**
 * User Status Management API Service
 *
 * Aligned with backend /api/v1/users/* routes (user-status-routes.ts)
 * Covers: status change, batch disable, session count, status history
 */
import { api } from './client';

// ==================== Interfaces ====================

export type UserStatus = 'active' | 'suspended' | 'terminated' | 'deleted';

export interface StatusChangeResult {
  userId: string;
  oldStatus: UserStatus;
  newStatus: UserStatus;
  reason?: string;
  changedAt: string;
}

export interface BatchDisableResult {
  disabledCount: number;
  results: Array<{
    userId: string;
    oldStatus: UserStatus;
    newStatus: UserStatus;
    revokedTokens: number;
  }>;
}

export interface SessionInfo {
  userId: string;
  activeSessions: number;
}

export interface StatusHistoryEntry {
  id: string;
  user_id: string;
  old_status: UserStatus;
  new_status: UserStatus;
  reason?: string;
  operator_id?: string;
  changed_at: string;
}

// ==================== Status Change ====================

export const changeUserStatus = async (userId: string, data: {
  status: UserStatus;
  reason?: string;
}): Promise<StatusChangeResult> => {
  const response = await api.patch<{ data: StatusChangeResult }>(`/v1/users/${userId}/status`, data);
  return response.data.data;
};

// ==================== Batch Disable ====================

export const batchDisableUsers = async (data: {
  department?: string;
  role?: string;
  reason?: string;
}): Promise<BatchDisableResult> => {
  const response = await api.post<{ data: BatchDisableResult }>('/v1/users/batch-disable', data);
  return response.data.data;
};

// ==================== Session Count ====================

export const getUserSessions = async (userId: string): Promise<SessionInfo> => {
  const response = await api.get<{ data: SessionInfo }>(`/v1/users/${userId}/sessions`);
  return response.data.data;
};

// ==================== Status History ====================

export const getUserStatusHistory = async (userId: string): Promise<StatusHistoryEntry[]> => {
  const response = await api.get<{ data: StatusHistoryEntry[] }>(`/v1/users/${userId}/status-history`);
  return response.data.data;
};
