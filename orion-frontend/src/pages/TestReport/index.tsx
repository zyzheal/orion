/**
 * Test Report Viewer Page
 * View test reports from pipeline runs with case-level details
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Button, Space, Tag, message, Tabs, Select, Input, Table, Statistic, Row, Col, Card, Descriptions } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, ReloadOutlined, FileTextOutlined, FileSearchOutlined, CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import {
  getTestReports,
  getTestCases,
  getRunSummary,
  type TestReport,
  type TestCase,
  type TestReportSummary,
} from '@/api/testReports';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;

const TestReportPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<TestReport[]>([]);
  const [summary, setSummary] = useState<TestReportSummary | null>(null);
  const [selectedReport, setSelectedReport] = useState<TestReport | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('list');

  const loadReports = async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const [reportsRes, summaryRes] = await Promise.all([
        getTestReports({ runId, page: 1, pageSize: 100 }),
        getRunSummary(runId),
      ]);
      if (reportsRes.data) {
        setReports(reportsRes.data.items || []);
      }
      if (summaryRes.data) {
        setSummary(summaryRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载测试报告失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [runId]);

  const loadCases = async (reportId: string) => {
    setCaseLoading(true);
    try {
      const res = await getTestCases(reportId, { page: 1, pageSize: 200 });
      if (res.data) {
        setCases(res.data.items || []);
      }
    } catch {
      message.error('加载测试用例失败');
    } finally {
      setCaseLoading(false);
    }
  };

  const handleSelectReport = async (report: TestReport) => {
    setSelectedReport(report);
    setActiveTab('cases');
    await loadCases(report.id);
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (caseStatusFilter !== 'all' && c.status !== caseStatusFilter) return false;
      if (caseSearch) {
        const q = caseSearch.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.fullName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [cases, caseSearch, caseStatusFilter]);

  const statusColor: Record<string, string> = {
    passed: 'green',
    failed: 'red',
    skipped: 'orange',
    error: 'red',
  };

  const statusIcon: Record<string, React.ReactNode> = {
    passed: <CheckCircleOutlined />,
    failed: <CloseCircleOutlined />,
    skipped: <MinusCircleOutlined />,
    error: <CloseCircleOutlined />,
  };

  const caseColumns = [
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => (
        <Tag color={statusColor[v]}>
          {statusIcon[v]} {v}
        </Tag>
      ),
    },
    {
      title: '用例名称',
      dataIndex: 'name',
      render: (v: string, r: TestCase) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          {r.className && <Text type="secondary" style={{ fontSize: spacing[2] }}>{r.className}</Text>}
        </Space>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      width: 100,
      render: (v: number) => `${(v / 1000).toFixed(2)}s`,
    },
    {
      title: '失败信息',
      dataIndex: 'failureMessage',
      render: (v: string) => v ? <Text type="danger">{v}</Text> : '-',
    },
  ];

  const reportColumns = [
    {
      title: '报告名称',
      dataIndex: 'suiteName',
      render: (v: string, r: TestReport) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => handleSelectReport(r)}
          >
            <FileTextOutlined /> {v}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            {r.format.toUpperCase()} · {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        </Space>
      ),
    },
    {
      title: '总计',
      dataIndex: 'totalTests',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '通过',
      dataIndex: 'passedTests',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Tag color="green">{v}</Tag>,
    },
    {
      title: '失败',
      dataIndex: 'failedTests',
      width: 80,
      align: 'center' as const,
      render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag>,
    },
    {
      title: '跳过',
      dataIndex: 'skippedTests',
      width: 80,
      align: 'center' as const,
      render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : <Tag>0</Tag>,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      width: 100,
      render: (v: number) => `${(v / 1000).toFixed(1)}s`,
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <div style={{ flex: 1 }}>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileSearchOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            测试报告
          </Title>
          <Text type="secondary">Run: {runId}</Text>
          <Text type="secondary">Run: {runId}</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadReports} loading={loading}>
          刷新
        </Button>
      </div>

      {/* Summary */}
      {summary && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Row gutter={16}>
            <Col span={4}>
              <Statistic title="总计" value={summary.totalTests} prefix={<FileTextOutlined />} />
            </Col>
            <Col span={4}>
              <Statistic
                title="通过"
                value={summary.totalPassed}
                valueStyle={{ color: colors.success?.[500] || colors.success[500] }}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="失败"
                value={summary.totalFailed}
                valueStyle={{ color: colors.error?.[500] || colors.error[400] }}
                prefix={<CloseCircleOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="跳过"
                value={summary.totalSkipped}
                prefix={<MinusCircleOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="通过率"
                value={summary.passRate}
                precision={1}
                suffix="%"
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="平均耗时"
                value={summary.avgDuration / 1000}
                precision={1}
                suffix="s"
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: '报告列表',
            children: (
              <Table
                columns={reportColumns}
                dataSource={reports}
                loading={loading}
                rowKey="id"
                size="middle"
              />
            ),
          },
          {
            key: 'cases',
            label: '测试用例',
            children: (
              <div>
                {selectedReport ? (
                  <>
                    <Descriptions
                      size="small"
                      column={3}
                      style={{ marginBottom: spacing.md }}
                      bordered
                    >
                      <Descriptions.Item label="报告">{selectedReport.suiteName}</Descriptions.Item>
                      <Descriptions.Item label="格式">{selectedReport.format.toUpperCase()}</Descriptions.Item>
                      <Descriptions.Item label="耗时">{(selectedReport.duration / 1000).toFixed(1)}s</Descriptions.Item>
                    </Descriptions>

                    {selectedReport.coverage && (
                      <Card title="覆盖率" size="small" style={{ marginBottom: spacing.md }}>
                        <Row gutter={16}>
                          <Col span={6}>
                            <Statistic title="行覆盖率" value={selectedReport.coverage.lines} precision={1} suffix="%" />
                          </Col>
                          <Col span={6}>
                            <Statistic title="分支覆盖率" value={selectedReport.coverage.branches} precision={1} suffix="%" />
                          </Col>
                          <Col span={6}>
                            <Statistic title="函数覆盖率" value={selectedReport.coverage.functions} precision={1} suffix="%" />
                          </Col>
                          <Col span={6}>
                            <Statistic title="语句覆盖率" value={selectedReport.coverage.statements} precision={1} suffix="%" />
                          </Col>
                        </Row>
                      </Card>
                    )}

                    <Space style={{ marginBottom: spacing.md }}>
                      <Search
                        placeholder="搜索用例名称"
                        value={caseSearch}
                        onChange={(e) => setCaseSearch(e.target.value)}
                        style={{ width: 250 }}
                      />
                      <Select
                        value={caseStatusFilter}
                        onChange={setCaseStatusFilter}
                        style={{ width: 120 }}
                        options={[
                          { label: '全部', value: 'all' },
                          { label: '通过', value: 'passed' },
                          { label: '失败', value: 'failed' },
                          { label: '跳过', value: 'skipped' },
                          { label: '错误', value: 'error' },
                        ]}
                      />
                      <Text type="secondary">共 {filteredCases.length} 个用例</Text>
                    </Space>

                    <Table
                      columns={caseColumns}
                      dataSource={filteredCases}
                      loading={caseLoading}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 50 }}
                    />
                  </>
                ) : (
                  <Text type="secondary">请先选择一个报告查看详情</Text>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default TestReportPage;
