/**
 * Federation API
 * Phase 4 - Cluster federation and cross-cluster job scheduling
 */
import apiClient from './client';

export interface FederationCluster {
  id: string;
  name: string;
  provider: string;
  region: string;
  status: 'active' | 'inactive' | 'degraded';
  nodeCount: number;
  registeredAt: string;
}

export interface ClusterHealth {
  clusterId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  cpuUsage: number;
  memoryUsage: number;
  podCount: number;
  lastChecked: string;
}

export interface CrossClusterJob {
  id: string;
  name: string;
  targetClusters: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  submittedAt: string;
  completedAt?: string;
}

export interface ResourcePool {
  id: string;
  name: string;
  clusterId: string;
  cpuCores: number;
  memoryMb: number;
  status: 'active' | 'inactive';
}

export const federationApi = {
  registerCluster: async (data: { name: string; provider: string; region: string; endpoint: string }) => {
    const response = await apiClient.post('/api/federation/clusters', data);
    return response.data as FederationCluster;
  },

  listClusters: async (params?: { status?: string }) => {
    const response = await apiClient.get('/api/federation/clusters', { params });
    return response.data as FederationCluster[];
  },

  getClusterHealth: async (clusterId: string) => {
    const response = await apiClient.get(`/api/federation/clusters/${clusterId}/health`);
    return response.data as ClusterHealth;
  },

  submitCrossClusterJob: async (data: { name: string; targetClusters: string[]; spec: Record<string, unknown> }) => {
    const response = await apiClient.post('/api/federation/jobs', data);
    return response.data as CrossClusterJob;
  },

  getJobStatus: async (jobId: string) => {
    const response = await apiClient.get(`/api/federation/jobs/${jobId}`);
    return response.data as CrossClusterJob;
  },

  listJobs: async (params?: { status?: string }) => {
    const response = await apiClient.get('/api/federation/jobs', { params });
    return response.data as CrossClusterJob[];
  },

  submitJob: async (data: { name: string; targetClusters: string[]; spec: Record<string, unknown> }) => {
    const response = await apiClient.post('/api/federation/jobs', data);
    return response.data as CrossClusterJob;
  },

  listResourcePools: async (params?: { clusterId?: string }) => {
    const response = await apiClient.get('/api/federation/resource-pools', { params });
    return response.data as ResourcePool[];
  },

  createResourcePool: async (data: { name: string; clusterId: string; cpuCores: number; memoryMb: number }) => {
    const response = await apiClient.post('/api/federation/resource-pools', data);
    return response.data as ResourcePool;
  },
};

export default federationApi;
