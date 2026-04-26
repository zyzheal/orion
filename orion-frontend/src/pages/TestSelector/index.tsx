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
import { Typography, Card, Tag, Space, Button, Alert, message } from 'antd';
import { Table as AntTable } from 'antd';
import { ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined, AppstoreOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DashboardLayout from '@/components/DashboardLayout';
import MetricCard from '@/components/MetricCard';
import Table, { TableColumn } from '@/components/Table';
import SearchFilterBar, { FilterDefinition } from '@/components/SearchFilterBar';

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

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_TEST_CASES: TestCase[] = [
  { key: 'test-001', name: 'User login with valid credentials', suite: 'Auth Suite', status: 'passed', duration: '234ms', lastRun: '2026-04-27 10:30', tags: ['smoke', 'auth'] },
  { key: 'test-002', name: 'User login with invalid password', suite: 'Auth Suite', status: 'passed', duration: '189ms', lastRun: '2026-04-27 10:30', tags: ['smoke', 'auth'] },
  { key: 'test-003', name: 'User login with expired token', suite: 'Auth Suite', status: 'failed', duration: '512ms', lastRun: '2026-04-27 09:15', tags: ['regression', 'auth'] },
  { key: 'test-004', name: 'Create pipeline with valid config', suite: 'Pipeline Suite', status: 'passed', duration: '1,203ms', lastRun: '2026-04-27 10:28', tags: ['smoke', 'pipeline'] },
  { key: 'test-005', name: 'Create pipeline with invalid YAML', suite: 'Pipeline Suite', status: 'passed', duration: '98ms', lastRun: '2026-04-27 10:28', tags: ['smoke', 'pipeline'] },
  { key: 'test-006', name: 'Deploy to staging environment', suite: 'Deploy Suite', status: 'passed', duration: '3,450ms', lastRun: '2026-04-27 10:25', tags: ['e2e', 'deploy'] },
  { key: 'test-007', name: 'Deploy with rollback trigger', suite: 'Deploy Suite', status: 'failed', duration: '4,102ms', lastRun: '2026-04-27 08:45', tags: ['e2e', 'deploy', 'regression'] },
  { key: 'test-008', name: 'Query metrics by time range', suite: 'Metrics Suite', status: 'passed', duration: '67ms', lastRun: '2026-04-27 10:30', tags: ['api', 'metrics'] },
  { key: 'test-009', name: 'Query metrics with invalid filters', suite: 'Metrics Suite', status: 'skipped', duration: '-', lastRun: '2026-04-26 16:00', tags: ['api', 'metrics'] },
  { key: 'test-010', name: 'Alert rule creation and trigger', suite: 'Alert Suite', status: 'passed', duration: '890ms', lastRun: '2026-04-27 10:20', tags: ['e2e', 'alert'] },
  { key: 'test-011', name: 'Alert rule escalation path', suite: 'Alert Suite', status: 'pending', duration: '-', lastRun: 'Never', tags: ['e2e', 'alert'] },
  { key: 'test-012', name: 'Self-healing strategy execution', suite: 'SelfHealing Suite', status: 'passed', duration: '2,340ms', lastRun: '2026-04-27 09:50', tags: ['e2e', 'self-healing'] },
  { key: 'test-013', name: 'Self-healing approval workflow', suite: 'SelfHealing Suite', status: 'failed', duration: '1,890ms', lastRun: '2026-04-27 08:30', tags: ['regression', 'self-healing'] },
  { key: 'test-014', name: 'Config management CRUD', suite: 'Config Suite', status: 'passed', duration: '156ms', lastRun: '2026-04-27 10:15', tags: ['api', 'config'] },
  { key: 'test-015', name: 'Config rollback to previous version', suite: 'Config Suite', status: 'skipped', duration: '-', lastRun: '2026-04-26 14:00', tags: ['regression', 'config'] },
  { key: 'test-016', name: 'Multi-tenant data isolation', suite: 'Tenant Suite', status: 'passed', duration: '789ms', lastRun: '2026-04-27 10:10', tags: ['e2e', 'tenant'] },
  { key: 'test-017', name: 'Cost estimation accuracy', suite: 'FinOps Suite', status: 'passed', duration: '345ms', lastRun: '2026-04-27 10:05', tags: ['api', 'finops'] },
  { key: 'test-018', name: 'Budget alert threshold trigger', suite: 'FinOps Suite', status: 'failed', duration: '567ms', lastRun: '2026-04-27 07:30', tags: ['regression', 'finops'] },
];

const SUITE_OPTIONS = MOCK_TEST_CASES
  .map((t) => t.suite)
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort()
  .map((s) => ({ label: s, value: s }));

const TAG_OPTIONS = MOCK_TEST_CASES
  .flatMap((t) => t.tags)
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort()
  .map((t) => ({ label: t, value: t }));

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Passed', value: 'passed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
  { label: 'Pending', value: 'pending' },
];

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
  const [usingMockData, setUsingMockData] = useState(true);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testStats, setTestStats] = useState<TestStats>({ total: 0, passed: 0, failed: 0, skipped: 0, passRate: '0%' });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [suiteFilter, setSuiteFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // No dedicated test API exists yet, using mock data
      setTestCases(MOCK_TEST_CASES);

      const passed = MOCK_TEST_CASES.filter((t) => t.status === 'passed').length;
      const failed = MOCK_TEST_CASES.filter((t) => t.status === 'failed').length;
      const skipped = MOCK_TEST_CASES.filter((t) => t.status === 'skipped').length;
      const total = MOCK_TEST_CASES.length;

      setTestStats({
        total,
        passed,
        failed,
        skipped,
        passRate: `${((passed / total) * 100).toFixed(1)}%`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载测试数据失败';
      console.error('Failed to load test data:', error);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter test cases based on search and filters
  const filteredCases = testCases.filter((test) => {
    const matchesSearch = !searchQuery || test.name.toLowerCase().includes(searchQuery.toLowerCase());
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
        <Text strong style={{ maxWidth: 320, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={String(value)}>
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
      render: (value: unknown) => (
        <Tag color={colors.primary[400]}>{String(value)}</Tag>
      ),
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
            <Tag key={tag} color={colors.neutral[300]} style={{ fontSize: 11 }}>{tag}</Tag>
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

  const handleRunSelected = useCallback(() => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one test to run');
      return;
    }
    const selectedTests = testCases.filter((t) => selectedRowKeys.includes(t.key));
    message.success(`Starting ${selectedTests.length} test(s): ${selectedTests.map((t) => t.name).join(', ').substring(0, 80)}...`);
  }, [selectedRowKeys, testCases]);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing[6], display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
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

      {/* Mock Data Warning */}
      {usingMockData && (
        <Alert
          type="warning"
          closable
          message="使用模拟数据"
          description="当前测试数据为演示用模拟数据，测试服务 API 尚未完全接入。"
          style={{ marginBottom: spacing[4] }}
          onClose={() => setUsingMockData(false)}
        />
      )}

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
