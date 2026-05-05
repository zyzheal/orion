/**
 * Artifact Operations API
 * Phase 4 - Artifact tracking, retention, scanning, cleanup
 */
import apiClient from './client';

export interface OperationTrack {
  artifactId: string;
  operation: 'deploy' | 'promote' | 'delete' | 'scan';
  status: 'success' | 'failed' | 'pending';
  performedBy: string;
  performedAt: string;
}

export interface OperationHistory {
  artifactId: string;
  operations: OperationTrack[];
  totalOperations: number;
}

export interface ArtifactStats {
  artifactId: string;
  deployCount: number;
  downloadCount: number;
  scanCount: number;
  lastDeployedAt?: string;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  criteria: { ageDays?: number; maxVersions?: number; environments?: string[] };
  schedule: 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
}

export interface ScanResult {
  artifactId: string;
  scanId: string;
  status: 'completed' | 'failed' | 'running';
  vulnerabilities?: { id: string; severity: string; description: string }[];
  scannedAt: string;
}

export const artifactOpsApi = {
  trackOperation: async (data: { artifactId: string; operation: string; status: string }) => {
    const response = await apiClient.post('/api/v1/artifact-ops/track', data);
    return response.data as OperationTrack;
  },

  getOperationHistory: async (artifactId: string) => {
    const response = await apiClient.get(`/api/v1/artifact-ops/history/${artifactId}`);
    return response.data as OperationHistory;
  },

  getArtifactStats: async (artifactId: string) => {
    const response = await apiClient.get(`/api/v1/artifact-ops/stats/${artifactId}`);
    return response.data as ArtifactStats;
  },

  defineRetentionPolicy: async (data: RetentionPolicy) => {
    const response = await apiClient.post('/api/v1/artifact-ops/retention', data);
    return response.data as RetentionPolicy;
  },

  cleanup: async (data: { policyId?: string; dryRun?: boolean }) => {
    const response = await apiClient.post('/api/v1/artifact-ops/cleanup', data);
    return response.data;
  },

  scanArtifact: async (artifactId: string) => {
    const response = await apiClient.post(`/api/v1/artifact-ops/scan/${artifactId}`);
    return response.data as ScanResult;
  },
};

export default artifactOpsApi;
