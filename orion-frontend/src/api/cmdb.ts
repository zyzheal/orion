/**
 * CMDB API Service
 * - CI (Configuration Item) CRUD
 * - Relations & Topology
 * - Hosts, K8s, CICD integration
 */
import apiClient from './client';

// ============================================================================
// Types
// ============================================================================

export interface CIItem {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  subtype?: string;
  status: string;
  owner?: string;
  environment?: string;
  tags: string[];
  attributes: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CIRelation {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  description?: string;
  created_at: string;
}

export interface TopologyNode {
  id: string;
  name: string;
  type: string;
  status: string;
  x?: number;
  y?: number;
  data?: Record<string, any>;
}

export interface TopologyEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface HostInfo {
  ci_id: string;
  hostname: string;
  ip: string;
  os: string;
  cpu: number;
  memory: number;
  disk: number;
  status: string;
  provider?: string;
  region?: string;
}

export interface K8sResource {
  kind: string;
  name: string;
  namespace: string;
  status: string;
  replicas?: { current: number; desired: number };
  created_at: string;
}

export interface CICDResource {
  type: string;
  name: string;
  url?: string;
  status: string;
  created_at?: string;
}

export interface CreateCIInput {
  tenant_id: string;
  name: string;
  type: string;
  subtype?: string;
  owner?: string;
  environment?: string;
  tags?: string[];
  attributes?: Record<string, any>;
}

export interface UpdateCIInput {
  name?: string;
  status?: string;
  owner?: string;
  environment?: string;
  tags?: string[];
  attributes?: Record<string, any>;
}

export interface ListCIsParams {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
  environment?: string;
  keyword?: string;
}

export interface CreateRelationInput {
  source_id: string;
  target_id: string;
  relation_type: string;
  description?: string;
}

// ============================================================================
// CI CRUD
// ============================================================================

export const getCIs = async (params?: ListCIsParams) => {
  const response = await apiClient.get('/v1/cmdb/cis', { params });
  return response.data as { data?: CIItem[] };
};

export const getCI = async (id: string) => {
  const response = await apiClient.get(`/v1/cmdb/cis/${id}`);
  return response.data as { ci?: CIItem };
};

export const createCI = async (input: CreateCIInput) => {
  const response = await apiClient.post('/v1/cmdb/cis', input);
  return response.data as { ci?: CIItem };
};

export const updateCI = async (id: string, input: UpdateCIInput) => {
  const response = await apiClient.put(`/v1/cmdb/cis/${id}`, input);
  return response.data as { ci?: CIItem };
};

export const deleteCI = async (id: string) => {
  const response = await apiClient.delete(`/v1/cmdb/cis/${id}`);
  return response.data;
};

// ============================================================================
// Relations
// ============================================================================

export const getCIRelations = async (ciId: string) => {
  const response = await apiClient.get(`/v1/cmdb/cis/${ciId}/relations`);
  return response.data as { data?: CIRelation[] };
};

export const createRelation = async (input: CreateRelationInput) => {
  const response = await apiClient.post('/v1/cmdb/relations', input);
  return response.data as { relation?: CIRelation };
};

export const deleteRelation = async (id: string) => {
  const response = await apiClient.delete(`/v1/cmdb/relations/${id}`);
  return response.data;
};

// ============================================================================
// Integration Read API
// ============================================================================

export const getHosts = async (params?: { page?: number; pageSize?: number }) => {
  const response = await apiClient.get('/v1/cmdb/hosts', { params });
  return response.data as { data?: HostInfo[] };
};

export const getHost = async (ciId: string) => {
  const response = await apiClient.get(`/v1/cmdb/hosts/${ciId}`);
  return response.data as { host?: HostInfo };
};

export const getK8sResources = async (params?: { kind?: string; namespace?: string }) => {
  const response = await apiClient.get('/v1/cmdb/k8s', { params });
  return response.data as { data?: K8sResource[] };
};

export const getCICDResources = async () => {
  const response = await apiClient.get('/v1/cmdb/cicd');
  return response.data as { data?: CICDResource[] };
};

export const getTopology = async (params?: { type?: string }) => {
  const response = await apiClient.get('/v1/cmdb/topology', { params });
  return response.data as { data?: TopologyData };
};

// ============================================================================
// K8s Sync
// ============================================================================

export const startK8sSync = async () => {
  const response = await apiClient.post('/v1/cmdb/k8s/sync/start');
  return response.data;
};

export const stopK8sSync = async () => {
  const response = await apiClient.post('/v1/cmdb/k8s/sync/stop');
  return response.data;
};

// ============================================================================
// Script Execution
// ============================================================================

export const executeScript = async (input: {
  target_ids: string[];
  script: string;
  timeout?: number;
}) => {
  const response = await apiClient.post('/v1/cmdb/execute', input);
  return response.data;
};

// ============================================================================
// Impact Analysis
// ============================================================================

export interface ImpactData {
  ci_id: string;
  ci_name: string;
  ci_type: string;
  upstream: CIItem[];
  downstream: CIItem[];
  total_affected: number;
}

export const getImpactAnalysis = async (ciId: string) => {
  const response = await apiClient.get(`/v1/cmdb/topology/${ciId}/impact`);
  return response.data as { data?: ImpactData };
};

// ============================================================================
// CI Versions
// ============================================================================

export const getCIVersions = async (ciId: string) => {
  const response = await apiClient.get(`/v1/cmdb/cis/${ciId}/versions`);
  return response.data as { versions?: unknown[] };
};

export const getCICurrentVersion = async (ciId: string) => {
  const response = await apiClient.get(`/v1/cmdb/cis/${ciId}/versions/current`);
  return response.data as { version?: number };
};

export const restoreCIVersion = async (ciId: string, version: string, user?: string) => {
  const response = await apiClient.post(`/v1/cmdb/cis/${ciId}/versions/restore`, { version, user });
  return response.data as { ci?: CIItem };
};

// ============================================================================
// CI by Business Key
// ============================================================================

export const getCIByCiId = async (ciId: string, tenantId?: string) => {
  const response = await apiClient.get(`/v1/cmdb/cis/by-id/${ciId}`, { params: { tenantId } });
  return response.data as { ci?: CIItem };
};

// ============================================================================
// Dependencies
// ============================================================================

export const getCIDependencies = async (ciId: string) => {
  const response = await apiClient.get(`/v1/cmdb/topology/${ciId}/dependencies`);
  return response.data as { topology?: unknown };
};

// ============================================================================
// Health
// ============================================================================

export const getCMDBHealth = async () => {
  const response = await apiClient.get('/v1/cmdb/health');
  return response.data;
};
