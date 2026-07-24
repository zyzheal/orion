export interface DigitalTwin {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  status: 'active' | 'inactive' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface DigitalTwinSnapshot {
  id: string;
  twinId: string;
  tenantId: string;
  config: Record<string, unknown>;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface SandboxInstance {
  id: string;
  tenantId: string;
  twinId: string;
  snapshotId: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: string;
  endpoint?: string;
}

export interface TrafficRecord {
  id: string;
  tenantId: string;
  twinId: string;
  recordingId: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  latency: number;
  payload?: Record<string, unknown>;
}

export interface RecordingSession {
  id: string;
  twinId: string;
  tenantId: string;
  status: 'recording' | 'paused' | 'stopped';
  startedAt: string;
  stoppedAt?: string;
  recordCount: number;
}

export interface TrafficReplayResult {
  id: string;
  twinId: string;
  recordingId: string;
  totalRequests: number;
  succeeded: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
}

export interface ReplaySession {
  id: string;
  twinId: string;
  tenantId: string;
  recordingId: string;
  status: 'replaying' | 'paused' | 'completed' | 'cancelled' | 'failed';
  startedAt: string;
  completedAt?: string;
  speedMultiplier: number;
}

export interface CreateTwinInput {
  name: string;
  description?: string;
  config: Record<string, unknown>;
}

export interface CreateSandboxInput {
  twinId: string;
  snapshotId?: string;
}

export interface TwinQuery {
  tenantId?: string;
  status?: string;
  page?: number;
  limit?: number;
}
