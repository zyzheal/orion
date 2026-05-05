/**
 * Digital Twin API
 * Phase 4 - Production snapshot and traffic replay
 */

import apiClient from './client';

export interface TwinSnapshot {
  id: string;
  tenant_id: string;
  environment: string;
  status: 'creating' | 'ready' | 'failed' | 'restoring';
  components: SnapshotComponent[];
  topology: Record<string, string[]>;
  size_bytes: number;
  created_at: string;
}

export interface SnapshotComponent {
  name: string;
  type: 'service' | 'database' | 'cache' | 'queue';
  version: string;
  replicas: number;
}

export interface TrafficRecording {
  id: string;
  tenant_id: string;
  source_env: string;
  status: 'recording' | 'completed' | 'stopped' | 'failed';
  request_count: number;
  size_bytes: number;
  started_at: string;
  completed_at?: string;
}

export interface TrafficReplay {
  id: string;
  recording_id: string;
  target_env: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  matched_count: number;
  mismatched_count: number;
  started_at: string;
}

export const digitalTwinApi = {
  // Snapshots
  listSnapshots: async (params?: { environment?: string; status?: string }) => {
    const response = await apiClient.get('/api/v1/digital-twin/snapshots', { params });
    return response.data;
  },

  getSnapshot: async (snapshotId: string) => {
    const response = await apiClient.get(`/api/v1/digital-twin/snapshots/${snapshotId}`);
    return response.data as TwinSnapshot;
  },

  createSnapshot: async (data: { environment: string; note?: string }) => {
    const response = await apiClient.post('/api/v1/digital-twin/snapshots', data);
    return response.data;
  },

  deleteSnapshot: async (snapshotId: string) => {
    const response = await apiClient.delete(`/api/v1/digital-twin/snapshots/${snapshotId}`);
    return response.data;
  },

  exportSnapshot: async (snapshotId: string) => {
    const response = await apiClient.get(`/api/v1/digital-twin/snapshots/${snapshotId}/export`);
    return response.data;
  },

  // Traffic Recording
  startRecording: async (data: { source_env: string; path_prefixes?: string[] }) => {
    const response = await apiClient.post('/api/v1/digital-twin/traffic/recording', data);
    return response.data as TrafficRecording;
  },

  getRecording: async (recordingId: string) => {
    const response = await apiClient.get(`/api/v1/digital-twin/traffic/recording/${recordingId}`);
    return response.data as TrafficRecording;
  },

  stopRecording: async (recordingId: string) => {
    const response = await apiClient.post(`/api/v1/digital-twin/traffic/recording/${recordingId}/stop`);
    return response.data;
  },

  listRecordings: async (params?: { source_env?: string }) => {
    const response = await apiClient.get('/api/v1/digital-twin/traffic/recordings', { params });
    return response.data;
  },

  // Traffic Replay
  startReplay: async (data: { recording_id: string; target_env: string; speed_multiplier?: number }) => {
    const response = await apiClient.post('/api/v1/digital-twin/traffic/replay', data);
    return response.data as TrafficReplay;
  },

  getReplay: async (replayId: string) => {
    const response = await apiClient.get(`/api/v1/digital-twin/traffic/replay/${replayId}`);
    return response.data as TrafficReplay;
  },

  getReplayReport: async (replayId: string) => {
    const response = await apiClient.get(`/api/v1/digital-twin/traffic/replay/${replayId}/report`);
    return response.data;
  },
};

export default digitalTwinApi;