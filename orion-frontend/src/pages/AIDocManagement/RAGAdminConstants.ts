/**
 * RAGAdminConstants.ts - RAG 管理页类型和常量
 * 抽取自 AIDocManagement/RAGAdmin.tsx (P2-9 Phase 98)
 */

export interface RAGConfig {
  default_top_k: number;
  reranker_threshold: number;
  max_context_chars: number;
  max_retries: number;
  mmr_lambda: number;
  daily_budget?: number;
  weekly_budget?: number;
  monthly_budget?: number;
  [key: string]: unknown;
}

export interface PromptTemplate {
  id?: string;
  name: string;
  version: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

export const CONFIG_FIELDS: Array<{
  key: keyof RAGConfig;
  label: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
}> = [
  {
    key: 'default_top_k',
    label: '默认 Top-K',
    description: '检索时默认返回的文档数量',
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'reranker_threshold',
    label: '重排序阈值',
    description: '重排序阶段的相关性分数阈值 (0-1)',
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'max_context_chars',
    label: '最大上下文字符数',
    description: '提供给 LLM 的上下文最大字符数',
    min: 1000,
    max: 100000,
    step: 500,
  },
  {
    key: 'max_retries',
    label: '最大重试次数',
    description: 'API 调用失败时的最大重试次数',
    min: 0,
    max: 10,
    step: 1,
  },
  {
    key: 'mmr_lambda',
    label: 'MMR Lambda',
    description: '最大边际相关性参数，控制结果多样性 (0-1)',
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: 'daily_budget',
    label: '日预算 (元)',
    description: '每日 API 调用预算上限',
    min: 0,
    max: 10000,
    step: 10,
  },
  {
    key: 'weekly_budget',
    label: '周预算 (元)',
    description: '每周 API 调用预算上限',
    min: 0,
    max: 100000,
    step: 50,
  },
  {
    key: 'monthly_budget',
    label: '月预算 (元)',
    description: '每月 API 调用预算上限',
    min: 0,
    max: 500000,
    step: 100,
  },
];

export const DEFAULT_CONFIG: RAGConfig = {
  default_top_k: 5,
  reranker_threshold: 0.3,
  max_context_chars: 15000,
  max_retries: 3,
  mmr_lambda: 0.5,
};
