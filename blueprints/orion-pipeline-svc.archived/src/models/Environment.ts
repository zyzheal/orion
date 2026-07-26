/**
 * Environment model types for pipeline environments.
 */

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

export interface EnvironmentEntity {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  variables: Record<string, string>;
  approvalRequired: boolean;
  approvalCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedVariables {
  variables: Record<string, string>;
  environment: {
    name: string;
    approvalRequired: boolean;
    approvalCount: number;
  };
}

export function createEnvironment(input: EnvironmentCreateInput): EnvironmentEntity & { id: string } {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: input.name,
    description: input.description ?? null,
    displayOrder: input.order ?? 0,
    variables: input.variables ?? {},
    approvalRequired: input.approvalRequired ?? false,
    approvalCount: input.approvalCount ?? 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeVariables(
  pipelineVars: Record<string, string>,
  envVars: Record<string, string>,
): Record<string, string> {
  return { ...pipelineVars, ...envVars };
}
