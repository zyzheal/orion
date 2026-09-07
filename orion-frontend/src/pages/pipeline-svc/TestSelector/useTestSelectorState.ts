/**
 * TestSelector state hook
 * 抽取自 index.tsx (P2-9 Phase 171)
 */
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { getTestCases, getTestStats, runTests } from '@/api/test-selector';
import { mapApiTestCase, mapApiTestStats } from './api';
import type { TestCase, TestStats } from './types';

export function useTestSelectorState() {
  const [loading, setLoading] = useState(true);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testStats, setTestStats] = useState<TestStats>({
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    passRate: '0%',
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [suiteFilter, setSuiteFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [testsRes, statsRes] = await Promise.all([getTestCases(), getTestStats()]);
      setTestCases((testsRes.data as any).testCases.map(mapApiTestCase));
      setTestStats(mapApiTestStats(statsRes.data.stats));
    } catch (error: unknown) {
      message.error(`Failed to load test data: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCases = testCases.filter((test) => {
    const matchesSearch =
      !searchQuery || test.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || test.status === statusFilter;
    const matchesSuite = !suiteFilter || test.suite === suiteFilter;
    const matchesTag = !tagFilter || test.tags.includes(tagFilter);
    return matchesSearch && matchesStatus && matchesSuite && matchesTag;
  });

  const handleRunSelected = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one test to run');
      return;
    }
    try {
      const response = await runTests(selectedRowKeys as string[]);
      message.success(`Test run started: ${response.data.runId}`);
    } catch (error: unknown) {
      message.error(`Failed to run tests: ${(error as Error).message}`);
    }
  }, [selectedRowKeys]);

  return {
    loading,
    testCases,
    testStats,
    selectedRowKeys,
    setSelectedRowKeys,
    searchQuery,
    setSearchQuery,
    setStatusFilter,
    setSuiteFilter,
    setTagFilter,
    loadData,
    filteredCases,
    handleRunSelected,
  };
}
