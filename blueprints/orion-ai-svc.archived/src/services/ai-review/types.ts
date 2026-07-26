/**
 * AI Review Types
 */

export interface ReviewRequest {
  prId: string;
  repoId: string;
  diff: string;
  repoType?: string;
  context?: Record<string, unknown>;
}

export interface ReviewHistoryQuery {
  repoId?: string;
  prId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export interface RuleCreateRequest {
  name: string;
  category: string;
  severity: string;
  pattern: string;
  description: string;
  suggestion?: string;
  fileExtensions?: string[];
}

export interface RuleUpdateRequest {
  name?: string;
  category?: string;
  severity?: string;
  pattern?: string;
  description?: string;
  suggestion?: string;
  fileExtensions?: string[];
  enabled?: boolean;
}
