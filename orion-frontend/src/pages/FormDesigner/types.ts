/**
 * FormDesigner types
 * 抽取自 index.tsx (P2-9 Phase 161)
 */

export interface FormSchema {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  version: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ConditionRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  actions: Record<string, any>;
  enabled: boolean;
  createdAt: string;
}
