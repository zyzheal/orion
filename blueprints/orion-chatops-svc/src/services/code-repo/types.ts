/**
 * Code Repo Types - Stub
 */
export interface BranchPolicy {
  id: string;
  repoId: string;
  branchPattern: string;
  preventForcePush: boolean;
  preventDeletion: boolean;
  mergeStrategy: string;
  approvalRules: any[];
  requiredChecks: string[];
  requireCodeOwners: boolean;
  linearHistory: boolean;
  allowAdminOverride: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MergeStrategy = 'merge' | 'squash' | 'rebase';

export interface CodeOwnersFile {
  path: string;
  content: string;
  rules: OwnershipRule[];
  repoId: string;
}

export interface OwnershipRule {
  pattern: string;
  owners: string[];
  approvers?: string[];
  requiredApprovals?: number;
}
