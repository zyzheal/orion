/**
 * TestSelector Page
 * Test Case Selection & Management - 测试用例选择与管理
 *
 * Features:
 * - Stats cards: Total Tests, Passed, Failed, Skipped
 * - Test case table: Test Name, Suite, Status, Duration, Last Run, Tags
 * - Filter by status, suite, and tags
 * - Search by test name
 * - Actions: Run selected tests, View detail
 *
 * Uses mock data with warning banner (no dedicated test API exists yet).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Card, Tag, Space, Button, message } from 'antd';
import { Table as AntTable } from 'antd';
import {
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  AppstoreOutlined,
  PlayCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import Table, { TableColumn } from '@/components/Table';
import SearchFilterBar, { FilterDefinition } from '@/components/SearchFilterBar';
import {
  getTestCases,
  getTestStats,
  runTests,
  type TestCase as APITestCase,
  type TestStats as APITestStats,
} from '@/api/test-selector';

const { Title, Text } = Typography;

// ============================================================================
// Type Definitions
// ============================================================================

interface TestCase {
  key: string;
  name: string;
  suite: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: string;
  lastRun: string;
  tags: string[];
}

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
}

/** Map API TestCase to UI shape */
function mapApiTestCase(t: APITestCase): TestCase {
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
function mapApiTestStats(s: APITestStats): TestStats {
  return {
    total: s.total,
    passed: s.passed,
    failed: s.failed,
    skipped: s.skipped,
    passRate: `${s.passRate.toFixed(1)}%`,
  };
}

// ============================================================================
// Filter Options (static until API provides them)
// ============================================================================

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Passed', value: 'passed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'Pending', value: 'pending' },
];

const SUITE_OPTIONS: { label: string; value: string }[] = [];
const TAG_OPTIONS: { label: string; value: string }[] = [];

// ============================================================================
// Helpers
// ============================================================================

function getStatusColor(status: TestCase['status']): string {
  switch (status) {
    case 'passed':
      return colors.success[500];
    case 'failed':
      return colors.error[500];
    case 'skipped':
      return colors.neutral[400];
    case 'pending':
      return colors.warning[500];
  }
}

function getStatusLabel(status: TestCase['status']): string {
  switch (status) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    case 'pending':
      return 'Pending';
  }
}

function getStatusIcon(status: TestCase['status']): React.ReactNode {
  switch (status) {
    case 'passed':
      return <CheckCircleOutlined />;
    case 'failed':
      return <CloseCircleOutlined />;
    case 'skipped':
      return <MinusCircleOutlined />;
    case 'pending':
      return <AppstoreOutlined />;
  }
}

// ============================================================================
// Component
// ============================================================================

const TestSelector: React.FC = () => {
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

  // Filter test cases based on search and filters
  const filteredCases = testCases.filter((test) => {
    const matchesSearch =
      !searchQuery || test.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || test.status === statusFilter;
    const matchesSuite = !suiteFilter || test.suite === suiteFilter;
    const matchesTag = !tagFilter || test.tags.includes(tagFilter);
    return matchesSearch && matchesStatus && matchesSuite && matchesTag;
  });

  // Table columns
  const testColumns: TableColumn<TestCase>[] = [
    {
      key: 'name',
      title: 'Test Name',
      dataIndex: 'name',
      sortable: true,
      render: (value: unknown) => (
        <Text
          strong
          style={{
            maxWidth: 320,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={String(value)}
        >
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'suite',
      title: 'Suite',
      dataIndex: 'suite',
      sortable: true,
      filterable: true,
      render: (value: unknown) => <Tag color={colors.primary[400]}>{String(value)}</Tag>,
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sortable: true,
      render: (_value: unknown, record: TestCase) => (
        <Tag color={getStatusColor(record.status)} icon={getStatusIcon(record.status)}>
          {getStatusLabel(record.status)}
        </Tag>
      ),
    },
    {
      key: 'duration',
      title: 'Duration',
      dataIndex: 'duration',
      sortable: true,
    },
    {
      key: 'lastRun',
      title: 'Last Run',
      dataIndex: 'lastRun',
      sortable: true,
    },
    {
      key: 'tags',
      title: 'Tags',
      dataIndex: 'tags',
      filterable: true,
      render: (value: unknown) => (
        <Space size={4} wrap>
          {(value as string[]).map((tag) => (
            <Tag key={tag} color={colors.neutral[300]} style={{ fontSize: 11 }}>
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_value: unknown, record: TestCase) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            style={{ color: colors.primary[500], padding: 0 }}
            onClick={() => {
              message.info(`Running test: ${record.name}`);
            }}
          >
            Run
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            style={{ color: colors.neutral[500], padding: 0 }}
            onClick={() => {
              message.info(`Viewing detail: ${record.name}`);
            }}
          >
            Detail
          </Button>
        </Space>
      ),
    },
  ];

  // Filter definitions
  const filterDefinitions: FilterDefinition[] = [
    {
      key: 'status',
      label: 'Status',
      options: STATUS_OPTIONS,
      placeholder: 'Filter by status',
    },
    {
      key: 'suite',
      label: 'Suite',
      options: [{ label: 'All Suites', value: '' }, ...SUITE_OPTIONS],
      placeholder: 'Filter by suite',
    },
    {
      key: 'tags',
      label: 'Tags',
      options: [{ label: 'All Tags', value: '' }, ...TAG_OPTIONS],
      placeholder: 'Filter by tags',
    },
  ];

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

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          marginBottom: spacing[6],
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ExperimentOutlined style={{ marginRight: spacing[2], color: colors.purple[500] }} />
            Test Selector
          </Title>
          <Text type="secondary">测试用例选择与管理</Text>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRunSelected}
            disabled={selectedRowKeys.length === 0}
          >
            Run Selected ({selectedRowKeys.length})
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <div style={{ marginBottom: spacing[6] }}>
        <DashboardLayout columns={4} gap={spacing[4]}>
          <MetricCard
            title="Total Tests"
            value={testStats.total}
            loading={loading}
            icon={<AppstoreOutlined style={{ color: colors.primary[500] }} />}
          />
          <MetricCard
            title="Passed"
            value={testStats.passed}
            unit={`(${testStats.passRate})`}
            loading={loading}
            color={colors.success[500]}
            icon={<CheckCircleOutlined />}
          />
          <MetricCard
            title="Failed"
            value={testStats.failed}
            loading={loading}
            color={colors.error[500]}
            icon={<CloseCircleOutlined />}
          />
          <MetricCard
            title="Skipped"
            value={testStats.skipped}
            loading={loading}
            color={colors.neutral[400]}
            icon={<MinusCircleOutlined />}
          />
        </DashboardLayout>
      </div>

      {/* Test Case Table */}
      <Card title={`Test Cases (${filteredCases.length} of ${testCases.length})`} size="small">
        {/* Search and Filter Bar */}
        <SearchFilterBar
          onSearch={setSearchQuery}
          filters={filterDefinitions}
          searchPlaceholder="Search tests by name..."
          onFilter={(filters) => {
            if (filters.status) setStatusFilter(String(filters.status));
            if (filters.suite) setSuiteFilter(String(filters.suite));
            if (filters.tags) setTagFilter(String(filters.tags));
          }}
          initialFilters={{ status: 'all', suite: '', tags: '' }}
        />

        <Table<TestCase>
          columns={testColumns}
          dataSource={filteredCases}
          rowKey="key"
          loading={loading}
          size="small"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            selections: [
              AntTable.SELECTION_ALL,
              AntTable.SELECTION_INVERT,
              AntTable.SELECTION_NONE,
            ],
          }}
        />
      </Card>
    </div>
  );
};

export default TestSelector;
