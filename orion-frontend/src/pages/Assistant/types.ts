/**
 * types.ts - Assistant 类型定义
 * 抽取自 Assistant/index.tsx (P2-9 Phase 66)
 */
import type { AssistantResponse, SourceIngestItem } from '@/api/assistant';

export interface ChatItem {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  response?: AssistantResponse;
}

export interface SourceSamples {
  label: string;
  source: 'alert' | 'ticket' | 'incident' | 'change';
  items: SourceIngestItem[];
}
