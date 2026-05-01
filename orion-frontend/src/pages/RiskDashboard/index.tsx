/**
 * Risk Dashboard Page
 * Risk assessment, health checks, and risk event monitoring
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Select,
  Input,
  message,
  Drawer,
  Descriptions,
  Timeline,
} from 'antd';
import { colors, spacing } from '@/tokens';
import {
  WarningOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import { HeatmapChart, BarChart, HeatmapCell, StatCard } from '@/components/charts';
import {
  assessDeploymentRisk,
  runHealthCheck,
  getRiskAssessments,
  getRiskEvents,
  acknowledgeRiskEvent,
  getRiskStatus,
  type RiskAssessment,
  type RiskAssessmentInput,
  type RiskEvent,
} from '@/api/risk';

const { Title, Text } = Typography;
const { TextArea } = Input;

const RiskDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [status, setStatus] = useState<{
    status: string;
    totalAssessments: number;
    pendingAssessments: number;
    highRiskCount: number;
  } | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assessModalOpen, setAssessModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [assessmentsRes, eventsRes, statusRes] = await Promise.all([
        getRiskAssessments({ pageSize: 20 }),
        getRiskEvents('unacknowledged'),
        getRiskStatus(),
      ]);
      setAssessments(assessmentsRes.data.data.assessments || []);
      setEvents(eventsRes.data.data.events || []);
      setStatus(statusRes.data.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载风险数据失败：${error.message}`);
      } else {
        message.error('加载风险数据失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssess = async (values: RiskAssessmentInput) => {
    try {
      await assessDeploymentRisk(values.targetId, {});
      message.success('风险评估已启动');
      setAssessModalOpen(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`风险评估失败：${error.message}`);
      } else {
        message.error('风险评估失败，请稍后重试');
      }
    }
  };

  const handleHealthCheck = async (checkType: 'basic' | 'comprehensive') => {
    try {
      await runHealthCheck(checkType);
      message.success('健康检查已完成');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`健康检查失败：${error.message}`);
      } else {
        message.error('健康检查失败，请稍后重试');
      }
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeRiskEvent(id);
      message.success('风险事件已确认');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`确认失败：${error.message}`);
      } else {
        message.error('确认失败，请稍后重试');
      }
    }
  };

  const riskLevelColor: Record<string, string> = {
    low: 'green',
    medium: 'blue',
    high: 'orange',
    critical: 'red',
  };

  const columns = [
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      render: (type: string) => (
        <Space>
          <FileTextOutlined />
          <Text>{type}</Text>
        </Space>
      ),
    },
    {
      title: '目标 ID',
      dataIndex: 'targetId',
      key: 'targetId',
      render: (id: string) => <Text code>{id}</Text>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (level: string) => <Tag color={riskLevelColor[level]}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '风险评分',
      dataIndex: 'riskScore',
      key: 'riskScore',
      render: (score: number) => (
        <Tag color={score > 70 ? 'red' : score > 40 ? 'orange' : 'green'}>
          {(score ?? 0).toFixed(0)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'green' : status === 'pending' ? 'orange' : 'red'}>
          {status === 'completed' ? '已完成' : status === 'pending' ? '评估中' : '失败'}
        </Tag>
      ),
    },
    {
      title: '评估时间',
      dataIndex: 'assessedAt',
      key: 'assessedAt',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RiskAssessment) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedAssessment(record);
            setDrawerOpen(true);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  const eventColumns = [
    {
      title: '事件类型',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type: string) => {
        const iconMap: Record<string, React.ReactNode> = {
          risk_detected: <ExclamationCircleOutlined />,
          risk_escalated: <WarningOutlined />,
          risk_mitigated: <CheckCircleOutlined />,
        };
        return (
          <Space>
            {iconMap[type]}
            <Text>{type}</Text>
          </Space>
        );
      },
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (level: string) => <Tag color={riskLevelColor[level]}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RiskEvent) =>
        !record.acknowledged ? (
          <Button type="link" size="small" onClick={() => handleAcknowledge(record.id)}>
            确认
          </Button>
        ) : (
          <Tag color="green">已确认</Tag>
        ),
    },
  ];

  const eventTableData = events.map((e) => ({
    key: e.id,
    ...e,
  }));

  // Heatmap data: assessments grouped by day-of-week × severity
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const severityLabels = ['Low', 'Medium', 'High', 'Critical'];
  const riskLevelToSeverity: Record<string, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  const heatmapData: HeatmapCell[] = assessments.map((a): HeatmapCell => {
    const dayIndex = new Date(a.assessedAt).getDay();
    return {
      x: dayLabels[dayIndex],
      y: riskLevelToSeverity[a.riskLevel] ?? 'Low',
      value: 1,
    };
  });

  // Bar chart data: risk type distribution by targetType
  const riskTypeData = Object.entries(
    assessments.reduce<Record<string, number>>((acc, a) => {
      acc[a.targetType] = (acc[a.targetType] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([label, value]) => ({ label, value }));

  return (
    <DashboardLayout>
      <div style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <Title level={2}>风险管理</Title>
            <Text type="secondary">风险评估、健康检查、风险事件监控</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button icon={<SafetyOutlined />} onClick={() => handleHealthCheck('basic')}>
              快速检查
            </Button>
            <Button
              icon={<ExclamationCircleOutlined />}
              onClick={() => handleHealthCheck('comprehensive')}
            >
              全面检查
            </Button>
            <Button
              icon={<WarningOutlined />}
              type="primary"
              onClick={() => setAssessModalOpen(true)}
            >
              风险评估
            </Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <StatCard title="总评估数" value={status?.totalAssessments || 0} />
          </Col>
          <Col span={6}>
            <StatCard title="评估中" value={status?.pendingAssessments || 0} />
          </Col>
          <Col span={6}>
            <StatCard title="高风险" value={status?.highRiskCount || 0} />
          </Col>
          <Col span={6}>
            <StatCard title="未确认事件" value={events.length} />
          </Col>
        </Row>

        {/* Risk Status */}
        <Card title="系统风险状态" style={{ marginBottom: 24 }}>
          <Space size="large">
            <div>
              <Text type="secondary">系统状态:</Text>{' '}
              <Tag color={status?.status === 'healthy' ? 'green' : 'red'}>
                {status?.status === 'healthy' ? '健康' : '异常'}
              </Tag>
            </div>
          </Space>
        </Card>

        {/* Charts Row */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={14}>
            <Card>
              <HeatmapChart
                title="风险分布（时间 × 严重性）"
                data={heatmapData}
                xAxis={dayLabels}
                yAxis={severityLabels}
                colorScale="green-red"
                height={280}
              />
            </Card>
          </Col>
          <Col span={10}>
            <Card>
              <BarChart
                title="风险类型分布"
                data={riskTypeData}
                height={280}
              />
            </Card>
          </Col>
        </Row>

        {/* Assessment Table */}
        <Card title="风险评估记录" style={{ marginBottom: 24 }}>
          <Table<RiskAssessment>
            columns={columns}
            dataSource={assessments}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </Card>

        {/* Events Table */}
        <Card title="风险事件">
          <Table
            columns={eventColumns}
            dataSource={eventTableData}
            loading={loading}
            pagination={{ pageSize: 5 }}
            size="small"
          />
        </Card>

        {/* Assess Modal */}
        <Modal
          title="风险评估"
          open={assessModalOpen}
          onCancel={() => setAssessModalOpen(false)}
          onOk={() => form.submit()}
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleAssess}>
            <Form.Item label="目标类型" name="targetType" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="deployment">部署</Select.Option>
                <Select.Option value="change">变更</Select.Option>
                <Select.Option value="pipeline">流水线</Select.Option>
                <Select.Option value="infrastructure">基础设施</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="目标 ID" name="targetId" rules={[{ required: true }]}>
              <Input placeholder="例如：deploy-123" />
            </Form.Item>
            <Form.Item label="元数据 (JSON)" name="metadata">
              <TextArea rows={4} placeholder='{"key": "value"}' />
            </Form.Item>
          </Form>
        </Modal>

        {/* Detail Drawer */}
        <Drawer
          title="风险评估详情"
          placement="right"
          width={700}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          {selectedAssessment && (
            <>
              <Descriptions column={1} bordered>
                <Descriptions.Item label="ID">{selectedAssessment.id}</Descriptions.Item>
                <Descriptions.Item label="目标类型">
                  {selectedAssessment.targetType}
                </Descriptions.Item>
                <Descriptions.Item label="目标 ID">{selectedAssessment.targetId}</Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  <Tag color={riskLevelColor[selectedAssessment.riskLevel]}>
                    {selectedAssessment.riskLevel.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="风险评分">
                  {selectedAssessment.riskScore.toFixed(0)}
                </Descriptions.Item>
                <Descriptions.Item label="状态">{selectedAssessment.status}</Descriptions.Item>
                <Descriptions.Item label="评估者">
                  {selectedAssessment.assessedBy}
                </Descriptions.Item>
                <Descriptions.Item label="评估时间">
                  {new Date(selectedAssessment.assessedAt).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>

              <Title level={5} style={{ marginTop: 24 }}>
                风险因素
              </Title>
              <Timeline>
                {selectedAssessment.factors.map((factor, index) => (
                  <Timeline.Item
                    key={index}
                    color={
                      factor.status === 'pass'
                        ? 'green'
                        : factor.status === 'warning'
                          ? 'orange'
                          : 'red'
                    }
                  >
                    <div>
                      <Text strong>{factor.name}</Text>
                      <div style={{ fontSize: spacing[3], color: colors.neutral[400] }}>
                        {factor.category}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary">{factor.description}</Text>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Text>
                          评分：{factor.score} | 权重：{factor.weight}
                        </Text>
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>

              {selectedAssessment.recommendations.length > 0 && (
                <>
                  <Title level={5}>改进建议</Title>
                  <ul>
                    {selectedAssessment.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </Drawer>
      </div>
    </DashboardLayout>
  );
};

export default RiskDashboardPage;
