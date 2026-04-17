/**
 * IaC Management 数据模型
 *
 * M20: IaC Workspace, Plan, State Version, Module
 */

import { v4 as uuidv4 } from 'uuid';

// ==================== IaCWorkspace ====================

export type IaCEnvironment = 'dev' | 'staging' | 'prod' | 'dr';
export type IaCWorkspaceStatus = 'active' | 'locked' | 'destroyed';
export type IaCProvider = 'terraform' | 'pulumi' | 'helm';

export interface IaCWorkspace {
  id: string;
  name: string;
  projectId: string;
  environment: IaCEnvironment;
  statePath: string;
  variables: Record<string, unknown>;
  lockedBy: string | null;
  status: IaCWorkspaceStatus;
  provider: IaCProvider;
  createdAt: Date;
}

export interface IaCWorkspaceCreateInput {
  name: string;
  projectId: string;
  environment: IaCEnvironment;
  statePath?: string;
  variables?: Record<string, unknown>;
  provider?: IaCProvider;
}

export interface IaCWorkspaceUpdateInput {
  name?: string;
  statePath?: string;
  variables?: Record<string, unknown>;
  status?: IaCWorkspaceStatus;
}

export function createIaCWorkspace(input: IaCWorkspaceCreateInput): IaCWorkspace {
  return {
    id: uuidv4(),
    name: input.name,
    projectId: input.projectId,
    environment: input.environment,
    statePath: input.statePath ?? '',
    variables: input.variables ?? {},
    lockedBy: null,
    status: 'active',
    provider: input.provider ?? 'terraform',
    createdAt: new Date(),
  };
}

// ==================== IaCPlan ====================

export type IaCPlanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'applied';

export interface IaCPlan {
  id: string;
  workspaceId: string;
  commitSha: string;
  status: IaCPlanStatus;
  resourceChanges: Record<string, unknown>;
  costEstimate: Record<string, unknown>;
  aiReview: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
}

export interface IaCPlanCreateInput {
  workspaceId: string;
  commitSha: string;
  resourceChanges?: Record<string, unknown>;
  costEstimate?: Record<string, unknown>;
}

export function createIaCPlan(input: IaCPlanCreateInput): IaCPlan {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    commitSha: input.commitSha,
    status: 'pending',
    resourceChanges: input.resourceChanges ?? {},
    costEstimate: input.costEstimate ?? {},
    aiReview: {},
    createdAt: now,
    expiresAt,
  };
}

// ==================== IaCStateVersion ====================

export interface IaCStateVersion {
  id: string;
  workspaceId: string;
  version: number;
  timestamp: Date;
  commitSha: string;
  author: string;
  size: number;
}

export interface IaCStateVersionCreateInput {
  workspaceId: string;
  version: number;
  commitSha: string;
  author: string;
  size: number;
}

export function createIaCStateVersion(input: IaCStateVersionCreateInput): IaCStateVersion {
  return {
    id: uuidv4(),
    workspaceId: input.workspaceId,
    version: input.version,
    timestamp: new Date(),
    commitSha: input.commitSha,
    author: input.author,
    size: input.size,
  };
}

// ==================== IaCModule ====================

export interface IaCModule {
  id: string;
  name: string;
  version: string;
  source: string;
  dependencies: Record<string, unknown>;
  createdAt: Date;
}

export interface IaCModuleCreateInput {
  name: string;
  version: string;
  source: string;
  dependencies?: Record<string, unknown>;
}

export function createIaCModule(input: IaCModuleCreateInput): IaCModule {
  return {
    id: uuidv4(),
    name: input.name,
    version: input.version,
    source: input.source,
    dependencies: input.dependencies ?? {},
    createdAt: new Date(),
  };
}
