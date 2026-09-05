/**
 * Product Line configuration constants
 * Color maps, option lists, and labels used across the ProductLine page
 */
import type { ProductLinePhase, BranchMode } from '@/api/product-lines';

/** Status phase → Ant Design Tag color */
export const phaseColorMap: Record<ProductLinePhase, string> = {
  Pending: 'orange',
  Active: 'green',
  Suspended: 'red',
  Error: 'magenta',
  Terminating: 'default',
};

/** Release train state → Ant Design Tag color */
export const releaseTrainStateColorMap: Record<string, string> = {
  Idle: 'default',
  Running: 'processing',
  Completed: 'success',
  Failed: 'error',
  Skipped: 'warning',
};

/** Human-readable labels for each branch mode */
export const branchModeLabels: Record<BranchMode, string> = {
  gitflow: 'GitFlow',
  'github-flow': 'GitHub Flow',
  'trunk-based': 'Trunk-Based',
};

export const branchModeOptions = [
  { label: 'GitFlow', value: 'gitflow' },
  { label: 'GitHub Flow', value: 'github-flow' },
  { label: 'Trunk Based', value: 'trunk-based' },
];

export const envOptions = [
  { label: 'Dev', value: 'dev' },
  { label: 'Test', value: 'test' },
  { label: 'Staging', value: 'staging' },
  { label: 'Pre-prod', value: 'preprod' },
  { label: 'Prod', value: 'prod' },
];

export const gitProviderOptions = [
  { label: 'GitHub', value: 'github' },
  { label: 'GitLab', value: 'gitlab' },
  { label: 'Gitea', value: 'gitea' },
  { label: 'Azure DevOps', value: 'azure-devops' },
];
