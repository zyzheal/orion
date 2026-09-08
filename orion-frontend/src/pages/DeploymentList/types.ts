/**
 * DeploymentList types
 * 抽取自 index.tsx (P2-9 Phase 198)
 */
export interface DeploymentRecord {
  id: string;
  appName: string;
  version: string;
  environment: string;
  strategy: string;
  status: string;
  triggeredBy: string;
  duration?: number;
  startTime: string;
  commit?: string;
}
