/**
 * Traffic Governance type definitions
 * 抽取自 index.tsx (P2-9 Phase 157)
 */

export interface TrafficRule {
  id: string;
  serviceName: string;
  environment: string;
  canaryVersion: string;
  baselineVersion: string;
  canaryWeight: number;
  baselineWeight: number;
  status: 'active' | 'promoted' | 'completed' | 'rolled_back';
  createdAt: string;
  updatedAt: string;
}

export interface TrafficStats {
  totalRules: number;
  activeRules: number;
  avgCanaryWeight: number;
  totalTraffic: number;
}
