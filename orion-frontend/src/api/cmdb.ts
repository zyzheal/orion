/**
 * CMDB API Service
 * - CI (Configuration Item) CRUD
 * - Relations & Topology
 * - Hosts, K8s, CICD integration
 */
import { api } from './client';

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
  return api.get('/v1/cmdb/cis', { params });
};

export const getCI = async (id: string) => {
  return api.get(`/v1/cmdb/cis/${id}`);
};

export const createCI = async (input: CreateCIInput) => {
  return api.post('/v1/cmdb/cis', input);
};

export const updateCI = async (id: string, input: UpdateCIInput) => {
  return api.put(`/v1/cmdb/cis/${id}`, input);
};

export const deleteCI = async (id: string) => {
  return api.delete(`/v1/cmdb/cis/${id}`);
};

// ============================================================================
// Relations
// ============================================================================

export const getCIRelations = async (ciId: string) => {
  return api.get(`/v1/cmdb/cis/${ciId}/relations`);
};

export const createRelation = async (input: CreateRelationInput) => {
  return api.post('/v1/cmdb/relations', input);
};

export const deleteRelation = async (id: string) => {
  return api.delete(`/v1/cmdb/relations/${id}`);
};

// ============================================================================
// Integration Read API
// ============================================================================

export const getHosts = async (params?: { page?: number; pageSize?: number }) => {
  return api.get('/v1/cmdb/hosts', { params });
};

export const getHost = async (ciId: string) => {
  return api.get(`/v1/cmdb/hosts/${ciId}`);
};

export const getK8sResources = async (params?: { kind?: string; namespace?: string }) => {
  return api.get('/v1/cmdb/k8s', { params });
};

export const getCICDResources = async () => {
  return api.get('/v1/cmdb/cicd');
};

export const getTopology = async (params?: { type?: string }) => {
  return api.get('/v1/cmdb/topology', { params });
};

// ============================================================================
// K8s Sync
// ============================================================================

export const startK8sSync = async () => {
  return api.post('/v1/cmdb/k8s/sync/start');
};

export const stopK8sSync = async () => {
  return api.post('/v1/cmdb/k8s/sync/stop');
};

// ============================================================================
// Script Execution
// ============================================================================

export const executeScript = async (input: {
  target_ids: string[];
  script: string;
  timeout?: number;
}) => {
  return api.post('/v1/cmdb/execute', input);
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
  return api.get(`/v1/cmdb/impact/${ciId}`);
};
