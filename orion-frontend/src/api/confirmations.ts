/**
 * Manual Confirmation API Service
 * Confirmation requests, batch operations, notifications, and audit
 */
import { api } from './client';

// ---- Types ----

export interface ConfirmationRequest {
  id: string;
  sceneType: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  aiSuggestion: string;
  aiConfidence: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
  pushTime: string;
  responseTime?: string;
  responder?: string;
  comment?: string;
  context?: Record<string, unknown>;
}

export interface ConfirmationAudit {
  id: string;
  confirmationId: string;
  action: string;
  user: string;
  timestamp: string;
  details?: string;
}

export interface ConfirmationInput {
  comment?: string;
  reason?: string;
}

export interface BatchApproveInput {
  ids: string[];
  comment?: string;
}

export interface NotificationSettings {
  channels: string[];
  dndStart: string;
  dndEnd: string;
  autoApproveP3: boolean;
  autoApproveAfterMinutes: number;
}

export interface ConfirmationListParams {
  sceneType?: string;
  priority?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export interface AuditListParams {
  confirmationId?: string;
  user?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

// ---- Confirmations ----

export function getConfirmations(params?: ConfirmationListParams) {
  return api.get('/api/confirmations', { params });
}

export function getConfirmation(id: string) {
  return api.get(`/api/confirmations/${id}`);
}

export function approveConfirmation(id: string, data?: ConfirmationInput) {
  return api.post(`/api/confirmations/${id}/approve`, data);
}

export function rejectConfirmation(id: string, data?: ConfirmationInput) {
  return api.post(`/api/confirmations/${id}/reject`, data);
}

export function batchApprove(data: BatchApproveInput) {
  return api.post('/api/confirmations/batch-approve', data);
}

// ---- Audit ----

export function getConfirmationAudit(params?: AuditListParams) {
  return api.get('/api/confirmations/audit', { params });
}

// ---- Notification Settings ----

export function getNotificationSettings() {
  return api.get('/api/confirmations/settings');
}

export function updateNotificationSettings(data: Partial<NotificationSettings>) {
  return api.put('/api/confirmations/settings', data);
}
