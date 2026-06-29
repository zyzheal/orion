/**
 * Disaster Recovery API
 * Phase 4 - DR plans, failover tests, backup management
 */
import apiClient from './client';

export interface DRPlan {
  id: string;
  name: string;
  description: string;
  rpo: number; // Recovery Point Objective in minutes
  rto: number; // Recovery Time Objective in minutes
  services: string[];
  status: 'active' | 'inactive' | 'testing';
  lastTestedAt?: string;
  createdAt: string;
}

export interface FailoverTest {
  id: string;
  planId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  results: { service: string; success: boolean; durationMs: number }[];
}

export interface BackupRecord {
  id: string;
  sourceService: string;
  sizeBytes: number;
  status: 'completed' | 'failed' | 'in_progress';
  createdAt: string;
}

export interface DRStatus {
  overallStatus: 'ready' | 'at_risk' | 'degraded';
  plans: { id: string; name: string; status: string; lastTestedAt?: string }[];
  recentBackups: BackupRecord[];
}

export const disasterRecoveryApi = {
  createDRPlan: async (data: {
    name: string;
    description: string;
    rpo: number;
    rto: number;
    services: string[];
  }) => {
    const response = await apiClient.post('/v1/disaster-recovery/plans', data);
    return response.data as DRPlan;
  },

  listDRPlans: async (params?: { status?: string }) => {
    const response = await apiClient.get('/v1/disaster-recovery/plans', { params });
    return response.data as DRPlan[];
  },

  executeFailoverTest: async (planId: string) => {
    const response = await apiClient.post(`/v1/disaster-recovery/plans/${planId}/failover-test`);
    return response.data as FailoverTest;
  },

  createBackup: async (data: { sourceService: string; type?: string }) => {
    const response = await apiClient.post('/v1/disaster-recovery/backups', data);
    return response.data as BackupRecord;
  },

  executeFailover: async (planId: string, data?: { reason?: string; dryRun?: boolean }) => {
    const response = await apiClient.post(`/v1/disaster-recovery/plans/${planId}/failover`, data);
    return response.data;
  },

  getDRStatus: async () => {
    const response = await apiClient.get('/v1/disaster-recovery/status');
    return response.data as DRStatus;
  },
};

export default disasterRecoveryApi;
