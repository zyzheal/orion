/**
 * types.ts - EvalSet 类型定义
 * 抽取自 EvalSetManagement/index.tsx (P2-9 Phase 60)
 */

export interface EvalSetCase {
  id: string;
  query: string;
  gold_answer?: string;
  gold_sources?: string;
  tags?: string;
}

export interface EvalSet {
  id: string;
  name: string;
  description?: string;
  version: number;
  is_active: boolean;
  cases?: EvalSetCase[];
  created_by?: string;
  created_at?: string;
}

export interface EvalRun {
  id: string;
  set_id: string;
  model: string;
  status: 'running' | 'completed' | 'failed';
  pass_count: number;
  total_count: number;
  avg_recall: number;
  avg_score: number;
  created_by?: string;
  created_at?: string;
}
