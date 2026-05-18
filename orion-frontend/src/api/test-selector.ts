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

// GET /v1/test-selector/cases - 获取测试用例列表
export async function getTestCases(filters?: { suite?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.suite) params.append('suite', filters.suite);
  if (filters?.status) params.append('status', filters.status);
  const qs = params.toString();
  return api.get<{ data: TestCase[] }>(`/v1/test-selector/cases${qs ? '?' + qs : ''}`);
}

// GET /v1/test-selector/suites - 获取测试套件列表
export async function getTestSuites() {
  return api.get<{ data: TestSuite[] }>('/v1/test-selector/suites');
}

// GET /v1/test-selector/coverage - 获取测试覆盖率
export async function getTestCoverage() {
  return api.get<{ data: Record<string, number> }>('/v1/test-selector/coverage');
}

// GET /v1/test-selector/flaky - 获取抖动测试
export async function getFlakyTests(threshold?: number) {
  const params = threshold ? `?threshold=${threshold}` : '';
  return api.get<{ data: { flakyTests: any[]; threshold: number } }>(`/v1/test-selector/flaky${params}`);
}

// GET /v1/test-selector/history - 获取测试历史
export async function getTestHistory() {
  return api.get<{ data: any[] }>('/v1/test-selector/history');
}

// 兼容旧接口
export async function getTestStats() {
  const [casesRes, suitesRes, coverageRes] = await Promise.all([
    api.get<{ data: TestCase[] }>('/v1/test-selector/cases'),
    api.get<{ data: TestSuite[] }>('/v1/test-selector/suites'),
    api.get<{ data: Record<string, number> }>('/v1/test-selector/coverage'),
  ]);

  const cases = casesRes.data?.data || [];
  const suites = suitesRes.data?.data || [];

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
        suites,
      },
    },
  };
}

export async function runTests(testIds: string[]) {
  return api.post<{ runId: string }>('/v1/test-selector/run', { testIds });
}
