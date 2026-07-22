/**
 * Graph API Service
 * Neo4j graph database query service for service dependency visualization,
 * infrastructure topology, and impact analysis
 */
import { api } from './client';

export interface GraphHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: string;
  nodeCount: number;
  edgeCount: number;
  lastChecked?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface GraphQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  graph?: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

export interface CypherQueryInput {
  query: string;
  parameters?: Record<string, unknown>;
}

export interface ServiceDependency {
  id: string;
  name: string;
  version?: string;
  dependencies: string[];
  dependents: string[];
  status: 'running' | 'stopped' | 'degraded' | 'unknown';
}

export interface ServiceDetail {
  id: string;
  name: string;
  version?: string;
  description?: string;
  owner?: string;
  status: 'running' | 'stopped' | 'degraded' | 'unknown';
  upstreamDependencies: ServiceDependency[];
  downstreamDependencies: ServiceDependency[];
  infrastructureNodes: InfrastructureNode[];
}

export interface InfrastructureNode {
  id: string;
  type: 'host' | 'network' | 'storage' | 'database' | 'cache' | 'load_balancer';
  name: string;
  status: 'online' | 'offline' | 'degraded';
  properties: Record<string, unknown>;
}

export interface InfrastructureTopology {
  nodes: InfrastructureNode[];
  edges: GraphEdge[];
}

export interface ImpactNode {
  service: ServiceDependency;
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
}

export interface ImpactAnalysis {
  serviceId: string;
  serviceName: string;
  directlyImpacted: ImpactNode[];
  transitivelyImpacted: ImpactNode[];
  infrastructureImpacted: InfrastructureNode[];
  summary: {
    totalImpacted: number;
    criticalCount: number;
    highCount: number;
  };
}

// ---- Health ----

export function getHealth() {
  return api.get<GraphHealth>('/graph/health');
}

// ---- Query ----

export function executeQuery(data: CypherQueryInput) {
  return api.post<GraphQueryResult>('/graph/query', data);
}

// ---- Service Dependencies ----

export function getServiceDependencies(params?: { tenantId?: string }) {
  return api.get<ServiceDependency[]>('/graph/services', { params });
}

export function getServiceDetail(id: string) {
  return api.get<ServiceDetail>(`/graph/services/${id}`);
}

// ---- Infrastructure Topology ----

export function getInfrastructureTopology(params?: { tenantId?: string }) {
  return api.get<InfrastructureTopology>('/graph/infrastructure', { params });
}

// ---- Impact Analysis ----

export function getImpactAnalysis(serviceId: string) {
  return api.get<ImpactAnalysis>(`/graph/impact/${serviceId}`);
}
