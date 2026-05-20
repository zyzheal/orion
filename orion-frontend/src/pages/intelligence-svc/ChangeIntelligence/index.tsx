/**
 * Change Intelligence Page
 * Reports list with risk scores, analysis trigger form, report detail with blast radius visualization
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  message,
  Descriptions,
} from 'antd';
import { colors, spacing } from '@/tokens';
import { ReloadOutlined, ThunderboltOutlined, BranchesOutlined } from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getChangeReports,
  getChangeReportDetail,
  getBlastRadius,
  analyzeChange,
  getChangeTrends,
  type ChangeIntelligenceReport,
  type AffectedService,
  type BlastRadiusData,
  type ChangeAnalyzeInput,
} from '@/api/change-intelligence';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const ChangeIntelligence: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ChangeIntelligenceReport[]>([]);
  const [trends, setTrends] = useState<Array<Record<string, unknown>>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);
  const [reportDetailVisible, setReportDetailVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ChangeIntelligenceReport | null>(null);
  const [blastRadius, setBlastRadius] = useState<BlastRadiusData | null>(null);
  const [affectedServices, setAffectedServices] = useState<AffectedService[]>([]);
  const [analyzeForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportRes, trendRes] = await Promise.all([
        getChangeReports(),
        getChangeTrends({ days: 30 }),
      ]);
      setReports(Array.isArray(reportRes.data.data) ? reportRes.data.data : []);
      setTrends(Array.isArray(trendRes.data.data) ? trendRes.data.data : []);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Failed to load change intelligence data';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !r.prId.toLowerCase().includes(q) &&
          !r.repoId.toLowerCase().includes(q) &&
          !r.commitSha.toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.riskLevel && filters.riskLevel !== 'all' && r.riskLevel !== filters.riskLevel)
        return false;
      return true;
    });
  }, [searchQuery, filters, reports]);

  const highRiskCount = reports.filter(
    (r) => r.riskLevel === 'high' || r.riskLevel === 'critical'
  ).length;
  const avgRiskScore =
    reports.length > 0 ? reports.reduce((sum, r) => sum + r.riskScore, 0) / reports.length : 0;

  const handleAnalyze = async (values: ChangeAnalyzeInput) => {
    try {
      await analyzeChange(values);
      message.success('Analysis triggered');
      setAnalyzeModalVisible(false);
      analyzeForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to trigger analysis';
      message.error(msg);
    }
  };

  const handleViewDetail = async (report: ChangeIntelligenceReport) => {
    setSelectedReport(report);
    try {
      const [detailRes, blastRes] = await Promise.all([
        getChangeReportDetail(report.id),
        getBlastRadius(report.id),
      ]);
      const detailData = detailRes.data.data as
        | { affectedServices?: AffectedService[] }
        | undefined;
      const svcList = detailData?.affectedServices;
      setAffectedServices(Array.isArray(svcList) ? svcList : []);
      setBlastRadius((blastRes.data.data as BlastRadiusData) || null);
      setReportDetailVisible(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load report detail';
      message.error(msg);
    }
  };

  const riskLevelColor: Record<string, string> = {
    low: 'green',
    medium: 'gold',
    high: 'orange',
    critical: 'red',
  };

  const columns: TableColumn<ChangeIntelligenceReport>[] = [
    {
      key: 'prId',
      title: 'PR',
      dataIndex: 'prId',
      width: 140,
      sortable: true,
      render: (_value: unknown, record: ChangeIntelligenceReport) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: colors.primary[500] }}>
            PR #{record.prId}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.repoId}
          </Text>
        </Space>
      ),
    },
    {
      key: 'commitSha',
      title: 'Commit',
      dataIndex: 'commitSha',
      width: 140,
      render: (value: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(value).slice(0, 7)}
        </Text>
      ),
    },
    {
      key: 'riskScore',
      title: '风险评分',
      dataIndex: 'riskScore',
      width: 120,
      sortable: true,
      render: (value: unknown) => {
        const score = Number(value);
        const color =
          score >= 0.8
            ? colors.error[600]
            : score >= 0.5
              ? colors.warning[500]
              : colors.success[600];
        return (
          <Text strong style={{ color, fontSize: spacing[4] }}>
            {(score * 100).toFixed(0)}%
          </Text>
        );
      },
    },
    {
      key: 'riskLevel',
      title: '风险级别',
      dataIndex: 'riskLevel',
      width: 120,
      render: (value: unknown) => (
        <Tag color={riskLevelColor[String(value)] || 'default'}>{String(value).toUpperCase()}</Tag>
      ),
    },
    {
      key: 'affectedServices',
      title: '影响服务',
      dataIndex: 'affectedServices',
      width: 100,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      key: 'gitlabCommentPosted',
      title: 'GitLab 评论',
      dataIndex: 'gitlabCommentPosted',
      width: 120,
      render: (value: unknown) => (
        <StatusBadge status={value ? 'success' : 'pending'} size="small" />
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: ChangeIntelligenceReport) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    {
      key: 'riskLevel',
      label: '风险级别',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <BranchesOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            AI 变更智能
          </Title>
          <Text type="secondary">语义影响面分析与风险评分</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => setAnalyzeModalVisible(true)}
          >
            触发分析
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="分析总数" value={reports.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均风险" value={avgRiskScore * 100} precision={1} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="高风险变更"
              value={highRiskCount}
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="趋势"
              value={trends.length > 0 ? '稳定' : '无数据'}
              valueStyle={{ color: colors.success[600] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Reports Table */}
      <Card title="变更智能报告">
        <div style={{ marginBottom: 16 }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索 PR、仓库、Commit..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredReports}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Analyze Modal */}
      <Modal
        title="触发变更分析"
        open={analyzeModalVisible}
        onCancel={() => setAnalyzeModalVisible(false)}
        onOk={() => analyzeForm.submit()}
        destroyOnClose
      >
        <Form form={analyzeForm} layout="vertical" onFinish={handleAnalyze}>
          <Form.Item name="prId" label="PR ID" rules={[{ required: true }]}>
            <Input placeholder="123" />
          </Form.Item>
          <Form.Item name="repoId" label="仓库 ID" rules={[{ required: true }]}>
            <Input placeholder="org/repo" />
          </Form.Item>
          <Form.Item name="commitSha" label="Commit SHA" rules={[{ required: true }]}>
            <Input placeholder="abc123def456..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Report Detail Modal */}
      <Modal
        title="变更分析报告详情"
        open={reportDetailVisible}
        onCancel={() => setReportDetailVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedReport && (
          <>
            <Descriptions bordered column={3} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="PR ID">{selectedReport.prId}</Descriptions.Item>
              <Descriptions.Item label="仓库">{selectedReport.repoId}</Descriptions.Item>
              <Descriptions.Item label="Commit">
                {selectedReport.commitSha.slice(0, 7)}
              </Descriptions.Item>
              <Descriptions.Item label="风险评分">
                <Text
                  strong
                  style={{
                    color:
                      selectedReport.riskScore >= 0.8
                        ? colors.error[600]
                        : selectedReport.riskScore >= 0.5
                          ? colors.warning[500]
                          : colors.success[600],
                  }}
                >
                  {(selectedReport.riskScore * 100).toFixed(1)}%
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="风险级别">
                <Tag color={riskLevelColor[selectedReport.riskLevel]}>
                  {selectedReport.riskLevel.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="影响服务">
                {selectedReport.affectedServices}
              </Descriptions.Item>
            </Descriptions>

            {/* SHAP Factors */}
            {selectedReport.shapFactors && selectedReport.shapFactors.length > 0 && (
              <Card title="SHAP 风险因子" size="small" style={{ marginBottom: 16 }}>
                {selectedReport.shapFactors.map(
                  (f: { factor: string; value: number; contribution: number }, i: number) => (
                    <Row key={i} style={{ marginBottom: 8 }}>
                      <Col span={6}>
                        <Text strong>{f.factor}</Text>
                      </Col>
                      <Col span={4}>
                        <Text>{f.value.toFixed(3)}</Text>
                      </Col>
                      <Col span={6}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 4,
                            background: colors.light.border.light,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(Math.abs(f.contribution) * 100, 100)}%`,
                              height: '100%',
                              borderRadius: 4,
                              background:
                                f.contribution > 0 ? colors.error[400] : colors.success[500],
                            }}
                          />
                        </div>
                      </Col>
                      <Col span={4}>
                        <Text type={f.contribution > 0 ? 'danger' : 'success'}>
                          {(f.contribution * 100).toFixed(1)}%
                        </Text>
                      </Col>
                    </Row>
                  )
                )}
              </Card>
            )}

            {/* Blast Radius Visualization */}
            {blastRadius && (
              <Card title="影响面图谱" size="small" style={{ marginBottom: 16 }}>
                <div style={{ minHeight: 200, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {blastRadius.nodes.map((node) => (
                    <Tag
                      key={node.id}
                      color={
                        node.type === 'file'
                          ? 'blue'
                          : node.type === 'service'
                            ? 'green'
                            : node.type === 'capability'
                              ? 'purple'
                              : node.type === 'slo'
                                ? 'red'
                                : 'default'
                      }
                      style={{ margin: 0, padding: '4px 8px' }}
                    >
                      {node.label}
                    </Tag>
                  ))}
                </div>
                <Text type="secondary" style={{ fontSize: spacing[3] }}>
                  {blastRadius.nodes.length} 个节点，{blastRadius.edges.length} 条边
                </Text>
              </Card>
            )}

            {/* Affected Services */}
            {affectedServices.length > 0 && (
              <Card title="受影响服务" size="small">
                <Table
                  columns={[
                    {
                      key: 'serviceName',
                      title: '服务名',
                      dataIndex: 'serviceName',
                      width: 160,
                      render: (value: unknown) => <Text strong>{String(value)}</Text>,
                    },
                    {
                      key: 'serviceTier',
                      title: '层级',
                      dataIndex: 'serviceTier',
                      width: 100,
                      render: (value: unknown) => (value ? <Tag>{String(value)}</Tag> : '-'),
                    },
                    {
                      key: 'impactType',
                      title: '影响类型',
                      dataIndex: 'impactType',
                      width: 120,
                      render: (value: unknown) => {
                        const colorMap: Record<string, string> = {
                          direct: 'red',
                          dependency: 'orange',
                          indirect: 'default',
                        };
                        return (
                          <Tag color={colorMap[String(value)] || 'default'}>{String(value)}</Tag>
                        );
                      },
                    },
                    {
                      key: 'sloRisk',
                      title: 'SLO 风险',
                      dataIndex: 'sloRisk',
                      width: 100,
                      render: (value: unknown) => {
                        const statusMap: Record<string, string> = {
                          none: 'success',
                          low: 'warning',
                          medium: 'failed',
                          high: 'failed',
                        };
                        return (
                          <StatusBadge
                            status={(statusMap[String(value)] || 'unknown') as StatusType}
                            size="small"
                          />
                        );
                      },
                    },
                    {
                      key: 'reviewers',
                      title: '推荐审批人',
                      dataIndex: 'recommendedReviewers',
                      width: 160,
                      render: (value: unknown) => (
                        <Text type="secondary">{value ? (value as string[]).join(', ') : '-'}</Text>
                      ),
                    },
                  ]}
                  dataSource={affectedServices}
                  rowKey="id"
                  size="small"
                  pagination={false}
                />
              </Card>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default ChangeIntelligence;
