/**
 * ABAC Policy API
 * 对接后端 /api/v1/abac-policies 端点
 */

import { api } from './client';

export interface AbacPolicy {
  id: string;
  name: string;
  description?: string;
  resourceType: string | string[];
  actionType: string | string[];
  conditions: any;
  effect: 'allow' | 'deny';
  priority?: number;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 获取所有策略
 */
export async function getAllPolicies() {
  const res = await api.get('/abac-policies');
  return res.data as { data: AbacPolicy[]; total: number };
}

/**
 * 获取单个策略
 */
export async function getPolicy(id: string) {
  const res = await api.get(`/abac-policies/${id}`);
  return res.data as { data: AbacPolicy };
}

/**
 * 获取资源类型对应的策略
 */
export async function getPoliciesByResourceType(resourceType: string) {
  const res = await api.get(`/abac-policies/resource/${resourceType}`);
  return res.data as { data: AbacPolicy[]; total: number };
}

/**
 * 创建策略
 */
export async function createPolicy(policy: Omit<AbacPolicy, 'id'>) {
  const res = await api.post('/abac-policies', policy);
  return res.data as { data: AbacPolicy; message: string };
}

/**
 * 更新策略
 */
export async function updatePolicy(id: string, updates: Partial<AbacPolicy>) {
  const res = await api.put(`/abac-policies/${id}`, updates);
  return res.data as { data: AbacPolicy; message: string };
}

/**
 * 删除策略
 */
export async function deletePolicy(id: string) {
  const res = await api.delete(`/abac-policies/${id}`);
  return res.data as { message: string };
}

/**
 * 启用/禁用策略
 */
export async function togglePolicy(id: string) {
  const res = await api.post(`/abac-policies/${id}/toggle`);
  return res.data as { data: AbacPolicy; message: string };
}