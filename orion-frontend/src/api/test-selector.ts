/**
 * Test Selector API Client
 *
 * Backend routes: orion-platform-service/src/api/test-selector-routes.ts
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

export async function getTestCases(filters?: { suite?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.suite) params.append('suite', filters.suite);
  if (filters?.status) params.append('status', filters.status);
  const qs = params.toString();
  return api.get<{ testCases: TestCase[] }>(`/v1/test-selector/tests${qs ? '?' + qs : ''}`);
}

export async function getTestStats() {
  return api.get<{ stats: TestStats }>('/v1/test-selector/stats');
}

export async function runTests(testIds: string[]) {
  return api.post<{ runId: string }>('/v1/test-selector/run', { testIds });
}
