/**
 * PromptCanary types
 * 抽取自 index.tsx (P2-9 Phase 183)
 */

export interface PromptVersionInfo {
  id: string;
  name: string;
  version: string;
  is_active: boolean;
  is_canary: boolean;
  traffic_percent: number;
  content_preview?: string;
  created_at?: string;
}

export interface PromptCanaryStatus {
  name: string;
  active_version: string;
  canary_version?: string;
  traffic_percent: number;
  versions: PromptVersionInfo[];
}
