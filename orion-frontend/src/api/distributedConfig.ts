/**
 * Distributed Config Center API Service
 * /config — Namespace / Group / Item / Snapshot / Release / Audit
 */
import { api } from './client';

// --- Types ---

export type ValueType = 'string' | 'int' | 'float' | 'bool' | 'json' | 'secret';

export interface ConfigNamespace {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ConfigGroup {
  id: string;
  tenantId: string;
  namespaceId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigItem {
  id: string;
  tenantId: string;
  groupId: string;
  namespaceId: string;
  keyName: string;
  value: string;
  valueType: ValueType;
  encrypted: boolean;
  description: string;
  labels?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigItemHistory {
  id: string;
  tenantId: string;
  itemId: string;
  version: number;
  newValue: string;
  oldValue?: string;
  operator: string;
  reason: string;
  createdAt: string;
}

export interface ConfigSnapshot {
  id: string;
  tenantId: string;
  groupId: string;
  namespaceId: string;
  environment: string;
  version: number;
  data: Record<string, unknown>;
  checksum: string;
  createdAt: string;
  createdBy: string;
}

export interface ConfigRelease {
  id: string;
  tenantId: string;
  snapshotId: string;
  groupId: string;
  environment: string;
  releaseVersion: number;
  status: 'pending' | 'released' | 'failed' | 'rollback';
  releaseNote: string;
  releasedAt?: string;
  releasedBy: string;
  rollbackToSnapshotId?: string;
  createdAt: string;
}

export interface ConfigAudit {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

// --- Namespace ---

export const listNamespaces = async () => {
  const res = await api.get('/config/namespaces');
  return res.data;
};

export const createNamespace = async (data: { name: string; description?: string }) => {
  const res = await api.post('/config/namespaces', data);
  return res.data;
};

export const getNamespace = async (id: string) => {
  const res = await api.get(`/config/namespaces/${id}`);
  return res.data;
};

// --- Group ---

export const listGroups = async (namespaceId?: string) => {
  const params: Record<string, string> = {};
  if (namespaceId) params.namespaceId = namespaceId;
  const res = await api.get('/config/groups', { params });
  return res.data;
};

export const createGroup = async (data: {
  namespaceId: string;
  name: string;
  description?: string;
}) => {
  const res = await api.post('/config/groups', data);
  return res.data;
};

// --- Item ---

export const listItems = async (groupId?: string, namespaceId?: string) => {
  const params: Record<string, string> = {};
  if (groupId) params.groupId = groupId;
  if (namespaceId) params.namespaceId = namespaceId;
  const res = await api.get('/config/items', { params });
  return res.data;
};

export const createItem = async (data: {
  groupId: string;
  namespaceId: string;
  keyName: string;
  value: string;
  valueType?: ValueType;
  encrypted?: boolean;
  description?: string;
  labels?: Record<string, string>;
}) => {
  const res = await api.post('/config/items', data);
  return res.data;
};

export const getItem = async (id: string) => {
  const res = await api.get(`/config/items/${id}`);
  return res.data;
};

export const updateItem = async (
  id: string,
  data: {
    value?: string;
    valueType?: ValueType;
    encrypted?: boolean;
    description?: string;
    labels?: Record<string, string>;
  }
) => {
  const res = await api.put(`/config/items/${id}`, data);
  return res.data;
};

export const deleteItem = async (id: string) => {
  const res = await api.delete(`/config/items/${id}`);
  return res.data;
};

export const getItemHistory = async (id: string) => {
  const res = await api.get(`/config/items/${id}/history`);
  return res.data;
};

// --- Snapshot ---

export const publishSnapshot = async (
  groupId: string,
  data: { environment: string; operator: string }
) => {
  const res = await api.post(`/config/snapshots?groupId=${groupId}`, data);
  return res.data;
};

export const listSnapshots = async (groupId?: string, environment?: string) => {
  const params: Record<string, string> = {};
  if (groupId) params.groupId = groupId;
  if (environment) params.environment = environment;
  const res = await api.get('/config/snapshots', { params });
  return res.data;
};

export const getSnapshotData = async (id: string) => {
  const res = await api.get(`/config/snapshots/${id}/data`);
  return res.data;
};

// --- Release ---

export const publishRelease = async (data: {
  snapshotId: string;
  environment: string;
  operator: string;
  releaseNote?: string;
}) => {
  const res = await api.post('/config/releases', data);
  return res.data;
};

export const rollbackRelease = async (data: {
  snapshotId: string;
  operator: string;
  reason?: string;
}) => {
  const res = await api.post('/config/releases/rollback', data);
  return res.data;
};

export const listReleases = async (environment?: string) => {
  const params: Record<string, string> = {};
  if (environment) params.environment = environment;
  const res = await api.get('/config/releases', { params });
  return res.data;
};

export const getRelease = async (id: string) => {
  const res = await api.get(`/config/releases/${id}`);
  return res.data;
};

export const getReleaseHistory = async (id: string) => {
  const res = await api.get(`/config/releases/${id}/history`);
  return res.data;
};

// --- Audit ---

export const listAudit = async (limit?: number) => {
  const params: Record<string, number> = {};
  if (limit) params.limit = limit;
  const res = await api.get('/config/audit', { params });
  return res.data;
};
