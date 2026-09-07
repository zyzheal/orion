/**
 * TestSelector API adapters
 * 抽取自 index.tsx (P2-9 Phase 171)
 */
import type {
  TestCase as APITestCase,
  TestStats as APITestStats,
} from '@/api/test-selector';
import type { TestCase, TestStats } from './types';

const statusMap: Record<string, TestCase['status']> = {
  pass: 'passed',
  fail: 'failed',
  skipped: 'skipped',
  pending: 'pending',
};

export function mapApiTestCase(t: APITestCase): TestCase {
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

export function mapApiTestStats(s: APITestStats): TestStats {
  return {
    total: s.total,
    passed: s.passed,
    failed: s.failed,
    skipped: s.skipped,
    passRate: `${s.passRate.toFixed(1)}%`,
  };
}
