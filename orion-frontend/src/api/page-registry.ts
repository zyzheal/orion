/**
 * PageRegistry API Service
 * Prefix: /api/v1/page-registry
 */

import { api } from './client';
import type { PageEntry } from '../router/page-registry-types';

export interface PageRegistryEntry {
  id: string;
  path: string;
  component: string;
  protected: boolean;
  permission: Record<string, any>;
  hideLayout: boolean;
  microApp: boolean;
  subAppKey: string | null;
  menuKey: string | null;
  menuLabel: string | null;
  menuIcon: string | null;
  hidden: boolean;
  redirectTo: string | null;
  title: string | null;
  breadcrumb: boolean;
  sortOrder: number;
  status: 'enabled' | 'disabled';
  tenantId: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listPageRegistry = async (params?: { enabled?: boolean }): Promise<{ data: PageRegistryEntry[]; total: number }> => {
  const endpoint = params?.enabled ? '/api/v1/page-registry/enabled' : '/api/v1/page-registry/';
  const response = await api.get<{ data: PageRegistryEntry[]; total?: number }>(endpoint, { params });
  return { data: response.data.data, total: response.data.total ?? response.data.data.length };
};

export const getPageEntry = async (path: string): Promise<PageRegistryEntry> => {
  const response = await api.get<PageRegistryEntry>('/api/v1/page-registry/' + encodeURIComponent(path));
  return response.data;
};

export const createPageEntry = async (data: Partial<PageRegistryEntry>): Promise<PageRegistryEntry> => {
  const response = await api.post<PageRegistryEntry>('/api/v1/page-registry/', data);
  return response.data;
};

export const updatePageEntry = async (path: string, data: Partial<PageRegistryEntry>): Promise<PageRegistryEntry> => {
  const response = await api.put<PageRegistryEntry>('/api/v1/page-registry/' + encodeURIComponent(path), data);
  return response.data;
};

export const deletePageEntry = async (path: string): Promise<void> => {
  await api.delete('/api/v1/page-registry/' + encodeURIComponent(path));
};

export const togglePageStatus = async (path: string): Promise<PageRegistryEntry> => {
  const response = await api.put<PageRegistryEntry>('/api/v1/page-registry/' + encodeURIComponent(path) + '/status');
  return response.data;
};

export const getPageHistory = async (path: string): Promise<PageRegistryEntry[]> => {
  const response = await api.get<{ data: PageRegistryEntry[] }>('/api/v1/page-registry/' + encodeURIComponent(path) + '/history');
  return response.data.data;
};
