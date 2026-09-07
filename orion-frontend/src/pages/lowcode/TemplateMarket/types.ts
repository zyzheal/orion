/**
 * TemplateMarket shared types
 * 抽取自 index.tsx (P2-9 Phase 141)
 */

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface ApplyTemplateInput {
  workflowName: string;
  description?: string;
}

export interface PublishFormValues extends CreateTemplateInput {
  flowId: string;
}
