/** IaCWorkspace model */

export type IaCWorkspaceStatus = 'active' | 'locked' | 'error' | 'destroyed';
export type IaCProvider = 'terraform' | 'pulumi' | 'crossplane' | 'cdk';
export type IaCEnvironment = 'dev' | 'staging' | 'production' | 'test';

export interface IaCWorkspace {
  id: string;
  name: string;
  provider: string;
  status: string;
}

export interface IaCModule {
  id: string;
  name: string;
  version: string;
  source: string;
  dependencies: Record<string, unknown>;
  createdAt: Date;
}

export interface IaCStateVersion {
  id: string;
  workspaceId: string;
  version: number;
  timestamp: Date;
  commitSha: string;
  author: string;
  size: number;
  createdAt?: string;
  serialNumber?: number;
  lineage?: string;
}
