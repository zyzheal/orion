/**
 * Notification Policy API
 * Phase 2 - Notification policy CRUD and workflow management
 */
import apiClient from './client';

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'regex';
  value: unknown;
}

export interface NotificationPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  conditions: PolicyCondition[];
  channels: string[];
  recipients: string[];
  throttleMinutes: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  type: 'notification' | 'delay' | 'escalation' | 'approval';
  config: Record<string, unknown>;
  order: number;
}

export interface NotificationWorkflow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  policyId: string;
  steps: WorkflowStep[];
  enabled: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyInput {
  name: string;
  description?: string;
  conditions: PolicyCondition[];
  channels: string[];
  recipients: string[];
  throttleMinutes?: number;
  enabled?: boolean;
}

export interface UpdatePolicyInput {
  name?: string;
  description?: string;
  conditions?: PolicyCondition[];
  channels?: string[];
  recipients?: string[];
  throttleMinutes?: number;
  enabled?: boolean;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  policyId: string;
  steps: WorkflowStep[];
  enabled?: boolean;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  steps?: WorkflowStep[];
  enabled?: boolean;
}

// Policies
export const listPolicies = () =>
  apiClient.get<NotificationPolicy[]>('/notification-policies');

export const getPolicy = (id: string) =>
  apiClient.get<NotificationPolicy>(`/notification-policies/${id}`);

export const createPolicy = (data: CreatePolicyInput) =>
  apiClient.post<NotificationPolicy>('/notification-policies', data);

export const updatePolicy = (id: string, data: UpdatePolicyInput) =>
  apiClient.put<NotificationPolicy>(`/notification-policies/${id}`, data);

export const deletePolicy = (id: string) =>
  apiClient.delete(`/notification-policies/${id}`);

export const evaluatePolicies = (event: Record<string, unknown>) =>
  apiClient.post<NotificationPolicy[]>('/notification-policies/evaluate', { event });

// Workflows
export const listWorkflows = (params?: { policyId?: string }) =>
  apiClient.get<NotificationWorkflow[]>('/notification-policies/workflows', { params });

export const getWorkflow = (id: string) =>
  apiClient.get<NotificationWorkflow>(`/notification-policies/workflows/${id}`);

export const createWorkflow = (data: CreateWorkflowInput) =>
  apiClient.post<NotificationWorkflow>('/notification-policies/workflows', data);

export const updateWorkflow = (id: string, data: UpdateWorkflowInput) =>
  apiClient.put<NotificationWorkflow>(`/notification-policies/workflows/${id}`, data);

export const deleteWorkflow = (id: string) =>
  apiClient.delete(`/notification-policies/workflows/${id}`);
