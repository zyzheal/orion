/**
 * CMDB Service API Client
 * CI (Configuration Item) management, relations, topology, and impact analysis
 * Backend: Go microservice (orion-cmdb-service) on port 3030
 */
import { api } from './client';

// ============================================================================
// Types
// ============================================================================

export interface CI {
  id: string;
  ci_id: string;
  ci_type: string;
  name: string;
  description: string;
  status: string;
  environment: string;
  tags: string[];
  attributes: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  owner?: string;
}

export interface Relation {
  id: string;
  from_ci_id: string;
  to_ci_id: string;
  relation_type: string;
  description?: string;
  created_at?: string;
}

export interface TopologyNode {
  id: string;
  name: string;
  type: string;
  status: string;
  x?: number;
  y?: number;
  data?: Record<string, unknown>;
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

export interface ImpactAnalysis {
  ci_id: string;
  name: string;
  affected_nodes: TopologyNode[];
  affected_relations: Relation[];
  risk_level: 'low' | 'medium' | 'high';
  recommendations: string[];
}

export interface CreateCIInput {
  ci_id?: string;
  name: string;
  ci_type: string;
  description?: string;
  environment?: string;
  tags?: string[];
  attributes?: Record<string, string>;
}

export interface UpdateCIInput {
  name?: string;
  description?: string;
  status?: string;
  environment?: string;
  tags?: string[];
  attributes?: Record<string, string>;
}

export interface ListCIParams {
  page?: number;
  pageSize?: number;
  ci_type?: string;
  status?: string;
  environment?: string;
  keyword?: string;
}

export interface CreateRelationInput {
  from_ci_id: string;
  to_ci_id: string;
  relation_type: string;
  description?: string;
}

// ============================================================================
// CI CRUD
// ============================================================================

export const getCIs = (params?: ListCIParams) => {
  return api.get('/v1/cmdb/cis', { params });
};

export const getCI = (id: string) => {
  return api.get(`/v1/cmdb/cis/${id}`);
};

export const createCI = (data: CreateCIInput) => {
  return api.post('/v1/cmdb/cis', data);
};

export const updateCI = (id: string, data: UpdateCIInput) => {
  return api.put(`/v1/cmdb/cis/${id}`, data);
};

export const deleteCI = (id: string) => {
  return api.delete(`/v1/cmdb/cis/${id}`);
};

// ============================================================================
// Relations
// ============================================================================

export const getRelations = (ciId?: string) => {
  return api.get('/v1/cmdb/relations', { params: ciId ? { ci_id: ciId } : {} });
};

export const createRelation = (data: CreateRelationInput) => {
  return api.post('/v1/cmdb/relations', data);
};

export const deleteRelation = (id: string) => {
  return api.delete(`/v1/cmdb/relations/${id}`);
};

// ============================================================================
// Topology
// ============================================================================

export const getTopology = (ciType?: string) => {
  return api.get('/v1/cmdb/topology', { params: ciType ? { ci_type: ciType } : {} });
};

// ============================================================================
// Impact Analysis
// ============================================================================

export const analyzeImpact = (ciId: string) => {
  return api.get(`/v1/cmdb/impact/${ciId}`);
};
