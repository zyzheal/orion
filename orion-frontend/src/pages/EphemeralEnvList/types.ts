/**
 * types.ts - EphemeralEnvList 类型
 * 抽取自 EphemeralEnvList/index.tsx (P2-9 Phase 69)
 */
import type { EphemeralEnvironment } from '@/api/ephemeral-envs';

/** 创建环境表单值 */
export interface CreateEnvFormValues {
  prId: string;
  repoId: string;
  branchName: string;
  commitSha: string;
  templateId?: string;
}

/** 汇总统计 */
export interface EnvSummary {
  totalCount: number;
  activeCount: number;
  runningCount: number;
  idleCount: number;
}

export type { EphemeralEnvironment };
