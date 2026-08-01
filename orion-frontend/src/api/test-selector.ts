/**
 * Test Selector API Client
 *
 * Backend routes: orion-platform-service/src/api/test-selector-routes.ts
 * Backend provides: /cases, /suites, /coverage, /flaky, /history
 */

import { api } from './client';

export interface TestCase {
  id: string;
  name: string;
  suite: string;
  status: 'pass' | 'fail' | 'skipped' | 'pending';
  duration?: number;
  lastRunAt?: string;
}

export interface TestSuite {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  suites: TestSuite[];
}

// GET /api/test-selector/cases - 获取测试用例列表
export async function getTestCases(filters?: { suite?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.suite) params.append('suite', filters.suite);
  if (filters?.status) params.append('status', filters.status);
  const qs = params.toString();
  return api.get<TestCase[]>(`/api/test-selector/cases${qs ? '?' + qs : ''}`);
}

// GET /api/test-selector/suites - 获取测试套件列表
export async function getTestSuites() {
  return api.get<TestSuite[]>('/api/test-selector/suites');
}

// GET /api/test-selector/coverage - 获取测试覆盖率
export async function getTestCoverage() {
  return api.get<Record<string, number>>('/api/test-selector/coverage');
}

export interface FlakyTest {
  id: string;
  name: string;
  suite: string;
  failRate: number;
  lastRunAt: string;
}

export interface TestHistoryEntry {
  id: string;
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

// GET /api/test-selector/flaky - 获取抖动测试
export async function getFlakyTests(threshold?: number) {
  const params = threshold ? `?threshold=${threshold}` : '';
  return api.get<{ flakyTests: FlakyTest[]; threshold: number }>(`/api/test-selector/flaky${params}`);
}

// GET /api/test-selector/history - 获取测试历史
export async function getTestHistory() {
  return api.get<TestHistoryEntry[]>('/api/test-selector/history');
}

// 兼容旧接口
export async function getTestStats() {
  const [casesRes, suitesRes] = await Promise.all([
    api.get<TestCase[]>('/api/test-selector/cases'),
    api.get<TestSuite[]>('/api/test-selector/suites'),
  ]);

  const cases = casesRes.data ?? [];
  const suites = suitesRes.data ?? [];

  const passed = cases.filter(c => c.status === 'pass').length;
  const failed = cases.filter(c => c.status === 'fail').length;
  const skipped = cases.filter(c => c.status === 'skipped').length;

  return {
    data: {
      stats: {
        total: cases.length,
        passed,
        failed,
        skipped,
        passRate: cases.length > 0 ? (passed / cases.length) * 100 : 0,
        suites: suites || [],
      },
    },
  };
}

export async function runTests(testIds: string[]) {
  return api.post<{ runId: string }>('/api/test-selector/run', { testIds });
}
