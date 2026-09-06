/**
 * Data Pipeline Monitor 类型定义
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
export interface Pipeline {
  id: string;
  name: string;
  source: string;
  target: string;
  frequency: 'realtime' | 'hourly' | 'daily';
  status: 'running' | 'error' | 'paused' | 'maintenance';
  lastRun: string;
  latency: number;
  successRate: number;
  isPaused: boolean;
}

export interface AlertRecord {
  id: string;
  pipelineName: string;
  alertType: 'delay' | 'missing' | 'quality' | 'interrupted';
  message: string;
  time: string;
  status: 'active' | 'resolved' | 'acknowledged';
}

export interface TopologyNode {
  id: string;
  label: string;
  type: 'source' | 'transform' | 'target';
  status: 'running' | 'error' | 'idle';
}

export interface TopologyEdge {
  source: string;
  target: string;
}
