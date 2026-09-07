/**
 * TestSelector API mappers
 * 抽取自 index.tsx (P2-9 Phase 173)
 */
import type { TestCase, TestStats } from './types';
import type { TestCase as APITestCase, TestStats as APITestStats } from '@/api/test-selector';

/** Map API TestCase to UI shape */
export function mapApiTestCase(t: APITestCase): TestCase {
  const statusMap: Record<string, TestCase['status']> = {
    pass: 'passed',
    fail: 'failed',
    skipped: 'skipped',
    pending: 'pending',
  };
  return {
    key: t.id,
    name: t.name,
    suite: t.suite,
    status: statusMap[t.status] ?? 'pending',
    duration: t.duration ? `${t.duration}ms` : '-',
    lastRun: t.lastRunAt ? new Date(t.lastRunAt).toLocaleString() : 'Never',
    tags: [],
  };
}

/** Map API TestStats to UI shape */
export function mapApiTestStats(s: APITestStats): TestStats {
  return {
    total: s.total,
    passed: s.passed,
    failed: s.failed,
    skipped: s.skipped,
    passRate: `${s.passRate.toFixed(1)}%`,
  };
}
