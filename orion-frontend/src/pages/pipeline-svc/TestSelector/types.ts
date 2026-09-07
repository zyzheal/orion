/**
 * TestSelector types
 * 抽取自 index.tsx (P2-9 Phase 171)
 */
export interface TestCase {
  key: string;
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: string;
  lastRun: string;
  tags: string[];
}

export interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
}
