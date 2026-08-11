/**
 * Firewall Policy API Client
 *
 * Backend routes: orion-platform-service/src/api/firewall-policies-routes.ts
 * 接口前缀: /api/v1/firewall-policies
 */

import { api } from './client';

export interface FirewallRule {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound';
  sourceIp: string;
  destPort: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  action: 'allow' | 'deny' | 'log';
  priority: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FirewallStats {
  total: number;
  active: number;
  inbound: number;
  outbound: number;
}

export interface FirewallSearchParams {
  direction?: 'inbound' | 'outbound';
  action?: 'allow' | 'deny' | 'log';
  protocol?: string;
  page?: number;
  pageSize?: number;
}

export function getFirewallRules(params?: FirewallSearchParams) {
  return api.get<FirewallRule[]>('/api/v1/firewall-policies', { params });
}

export function getFirewallStats() {
  return api.get<FirewallStats>('/api/v1/firewall-policies/stats');
}

export function createFirewallRule(
  data: Omit<FirewallRule, 'id' | 'createdAt' | 'updatedAt'>
) {
  return api.post<FirewallRule>('/api/v1/firewall-policies', data);
}

export function updateFirewallRule(
  id: string,
  data: Partial<FirewallRule>
) {
  return api.put<FirewallRule>(`/api/v1/firewall-policies/${id}`, data);
}

export function deleteFirewallRule(id: string) {
  return api.delete<void>(`/api/v1/firewall-policies/${id}`);
}

export function toggleFirewallRule(id: string, enabled: boolean) {
  return api.patch<FirewallRule>(`/api/v1/firewall-policies/${id}/toggle`, { enabled });
}