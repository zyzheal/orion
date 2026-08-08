/**
 * Test Execution Engine (P2-28)
 * 测试执行引擎 — 测试套件管理 + 执行历史 + 覆盖率 + 不稳定测试
 */
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Statistic, Tag, Spin, Button, Space, Select, Modal, message } from 'antd';
import { RocketOutlined, BarChartOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { getFlakyTests, getTestCoverage, getTestHistory } from '@/api/test-selector';

const { Title, Text } = Typography;
const { Option } = Select;

interface TestResult {
  id: string;
  suiteName: string;
  caseName: string;
  status: 'passed' | 'failed' | 'skipped' | 'blocked' | 'error' | 'pending';
  duration: number;
  timestamp: string;
}

const TestExecution: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<TestResult[]>([]);
  const [flakyTests, setFlakyTests] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hRes, fRes, cRes] = await Promise.all([
        getTestHistory().catch(() => null),
        getFlakyTests(0.3).catch(() => null),
        getTestCoverage().catch(() => null),
      ]);
      setHistory((hRes as any)?.data ?? (hRes as any) ?? []);
      setFlakyTests((fRes as any)?.data?.flakyTests ?? (fRes as any)?.flakyTests ?? []);
      setCoverage((cRes as any)?.data ?? (cRes as any) ?? {});
    } catch { message.error('Failed to load test data'); }
    finally { setLoading(false); }
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    passed: { color: colors.success[500], label: '通过' },
    failed: { color: colors.error[500], label: '失败' },
    skipped: { color: colors.neutral[500], label: '跳过' },
    blocked: { color: colors.warning[500], label: '阻塞' },
    error: { color: colors.error[500], label: '错误' },
    pending: { color: colors.info[500], label: '待执行' },
  };

  const passedCount = history.filter((t: TestResult) => t.status === 'passed').length;
  const failedCount = history.filter((t: TestResult) => t.status === 'failed').length;
  const errorCount = history.filter((t: TestResult) => t.status === 'error').length;
  const totalDuration = history.reduce((s: number, t: TestResult) => s + (t.duration || 0), 0);

  const columns = [
    { title: '测试套件', dataIndex: 'suiteName', key: 'suiteName' },
    { title: '测试用例', dataIndex: 'caseName', key: 'caseName' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusConfig[s]?.color || colors.neutral[400]}>{s}</Tag>,
    },
    { title: '耗时(ms)', dataIndex: 'duration', key: 'duration', render: (v: number) => v ? v : '-' },
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', render: (t: string) => t ? new Date(t).toLocaleString() : '-' },
  ];

  const flakyColumns = [
    { title: '测试用例', dataIndex: 'testName', key: 'testName', render: (v: string) => <Text code>{v}</Text> },
    { title: '通过率', dataIndex: 'passRate', key: 'passRate', render: (v: number) => <Tag color={v >= 0.8 ? 'green' : v >= 0.5 ? 'orange' : 'red'}>{Math.round((v || 0) * 100)}%</Tag> },
    { title: '失败次数', dataIndex: 'failCount', key: 'failCount' },
    { title: '总运行次数', dataIndex: 'totalRuns', key: 'totalRuns' },
    { title: '上次失败', dataIndex: 'lastFailAt', key: 'lastFailAt', render: (t: string) => t ? new Date(t).toLocaleString() : '-' },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <Col>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <RocketOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            测试执行引擎
          </Title>
          <Text type="secondary">测试套件执行 · 不稳定测试 · 覆盖率</Text>
        </Col>
        <Col>
          <Space>
            <Select
              style={{ width: 120 }}
              value={selectedEnv || undefined}
              onChange={(v) => setSelectedEnv(v || null)}
              allowClear
              placeholder="环境"
            >
              <Option value="dev">开发</Option>
              <Option value="staging">预发布</Option>
              <Option value="prod">生产</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card><Statistic title="总测试用例" value={history.length} prefix={<BarChartOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="通过" value={passedCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: colors.success[500] }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="失败" value={failedCount + errorCount} prefix={<CloseCircleOutlined />} valueStyle={{ color: colors.error[500] }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="总耗时(ms)" value={totalDuration} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
      </Row>

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={16}>
          <Card title="测试执行历史">
            <Spin spinning={loading}>
              <Table columns={columns} dataSource={history} rowKey="id" size="small" pagination={{ pageSize: 10, showSizeChanger: false }} />
            </Spin>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="覆盖率">
            <Spin spinning={loading}>
              {Object.entries(coverage).length > 0 ? (
                <Table
                  columns={[
                    { title: '文件/模块', dataIndex: '0', key: 'file', render: (v: string) => <Text code>{v}</Text> },
                    { title: '覆盖率', dataIndex: '1', key: 'pct', render: (v: number) => <Tag color={v >= 80 ? 'green' : v >= 50 ? 'orange' : 'red'}>{Math.round(v)}%</Tag> },
                  ]}
                  dataSource={Object.entries(coverage).map(([k, v]) => [k, v])}
                  rowKey="0"
                  size="small"
                  pagination={false}
                />
              ) : (
                <Text type="secondary">暂无覆盖率数据</Text>
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      <Card title="不稳定测试 (Flaky Tests)" extra={<Tag color="warning">{flakyTests.length} 个</Tag>}>
        <Spin spinning={loading}>
          <Table columns={flakyColumns} dataSource={flakyTests} rowKey="id" size="small" pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: <Text type="secondary">无不稳定测试</Text> }} />
        </Spin>
      </Card>

      <Modal
        title="测试环境选择"
        open={false}
        footer={null}
      />
    </div>
  );
};

export default TestExecution;
