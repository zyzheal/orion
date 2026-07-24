/**
 * Deployment Strategy types — Canary, Blue-Green, Rolling
 */
export type DeploymentStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'healthy' | 'unhealthy' | 'rolledback';

export interface CanaryStep {
  weight: number;
  pause?: string;
  verification?: string;
  [key: string]: unknown;
}

export interface CanaryConfig {
  steps: CanaryStep[];
  rollbackOnFailure?: boolean;
  [key: string]: unknown;
}

export interface BlueGreenConfig {
  switchMethod?: 'instant' | 'gradual';
  gradualSteps?: number[];
  activeSlot?: 'blue' | 'green';
  [key: string]: unknown;
}

export interface RollingConfig {
  batchSize: number;
  pauseBetweenBatches?: string;
  maxUnavailable?: number;
  [key: string]: unknown;
}

export type DeploymentConfig = CanaryConfig | BlueGreenConfig | RollingConfig;

export interface DeploymentStrategy {
  id: string;
  tenantId: string;
  name: string;
  type: 'canary' | 'bluegreen' | 'rolling';
  config: DeploymentConfig;
  description?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentStrategyEntity {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  description?: string | null;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}
