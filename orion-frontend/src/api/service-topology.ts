/**
 * Service Topology API Client
 *
 * Maps to /api/service-topology endpoints.
 */

import apiClient from './client';

export interface TopologyNode {
  id: string;
  name: string;
  type: string;
  health: string;
  address: string;
}

export interface TopologyEdge {
  source: string;
  target: string;
  type: string;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: string;
  direction: 'outgoing' | 'incoming';
}

export interface ServiceDependencies {
  service: TopologyNode;
  nodes: TopologyNode[];
  outgoingDependencies: DependencyEdge[];
  incomingDependents: DependencyEdge[];
}

export const serviceTopologyApi = {
  getTopology() {
    return apiClient.get<TopologyGraph>('/api/service-topology/topology');
  },

  getServiceTopology(serviceId: string) {
    return apiClient.get<TopologyGraph>(`/api/service-topology/topology/${encodeURIComponent(serviceId)}`);
  },

  getServiceDependencies(serviceId: string) {
    return apiClient.get<ServiceDependencies>(`/api/service-topology/dependencies/${encodeURIComponent(serviceId)}`);
  },
};

export default serviceTopologyApi;
