/**
 * Environment 数据模型
 * GAP-CN-02: Multi-environment management for pipeline deployments.
 *
 * Environments represent deployment targets (development, staging, production)
 * with their own variables and approval requirements.
 */

import { v4 as uuidv4 } from 'uuid';

export interface Environment {
  id: string;
  tenantId: string;
  name: string;  // 'development', 'staging', 'production', etc.
  description?: string;
  order: number;  // for display ordering
  variables: Record<string, string>;  // environment-specific variables
  approvalRequired: boolean;  // requires approval before deploying to this env
  approvalCount: number;  // number of approvals needed
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvironmentCreateInput {
  tenantId: string;
  name: string;
  description?: string;
  order?: number;
  variables?: Record<string, string>;
  approvalRequired?: boolean;
  approvalCount?: number;
}

export interface EnvironmentUpdateInput {
  description?: string;
  order?: number;
  variables?: Record<string, string>;
  approvalRequired?: boolean;
  approvalCount?: number;
}

/**
 * Create a new Environment entity.
 */
export function createEnvironment(input: EnvironmentCreateInput): Environment {
  const now = new Date();
  return {
    id: uuidv4(),
    tenantId: input.tenantId,
    name: input.name,
    description: input.description,
    order: input.order ?? 0,
    variables: input.variables ?? {},
    approvalRequired: input.approvalRequired ?? false,
    approvalCount: input.approvalCount ?? 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Merge environment variables with pipeline-level variables.
 * Environment variables override pipeline-level variables when both define the same key.
 */
export function mergeVariables(
  pipelineVars: Record<string, string>,
  environmentVars: Record<string, string>,
): Record<string, string> {
  return { ...pipelineVars, ...environmentVars };
}
