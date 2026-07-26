/**
 * Deployment event data types
 *
 * Stub for orion-platform-service events/types/deployment
 */

export interface DeploymentCompletedEventData {
  deploymentId: string;
  service: string;
  environment: string;
  version?: string;
  durationMs?: number;
  timestamp: string;
  tenantId?: string;
}

export interface DeploymentFailedEventData {
  deploymentId: string;
  service: string;
  environment: string;
  version?: string;
  error?: string;
  timestamp: string;
  tenantId?: string;
}
