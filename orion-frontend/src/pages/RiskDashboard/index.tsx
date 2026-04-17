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
  Statistic,
  Progress,
  Modal,
  Form,
  Select,
  Input,
  message,
  Drawer,
  Descriptions,
  Timeline,
} from 'antd';
import {
  WarningOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/DashboardLayout';
import {
  assessRisk,
  runHealthCheck,
  getRiskAssessments,
  getRiskEvents,
  acknowledgeRiskEvent,
  getRiskStatus,
  type RiskAssessment,
  type RiskEvent,
} from '@/api/risk';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface RiskRecord {
  key: string;
  id: string;
  targetType: string;
  targetId: string;
  riskLevel: string;
  riskScore: number;
  status: string;
  assessedAt: string;
}

const RiskDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [status, setStatus] = useState<any>(null);
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
    } catch (error) {
      console.error('Failed to load risk data:', error);
      message.error('加载风险数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssess = async (values: any) => {
    try {
      await assessRisk({
        targetType: values.targetType,
        targetId: values.targetId,
        metadata: values.metadata ? JSON.parse(values.metadata) : undefined,
      });
      message.success('风险评估已启动');
      setAssessModalOpen(false);
      loadData();
    } catch (error) {
      message.error('风险评估失败');
    }
  };

  const handleHealthCheck = async (checkType: 'basic' | 'comprehensive') => {
    try {
      await runHealthCheck(checkType);
      message.success('健康检查已完成');
      loadData();
    } catch (error) {
      message.error('健康检查失败');
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeRiskEvent(id);
      message.success('风险事件已确认');
      loadData();
    } catch (error) {
      message.error('确认失败');
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
      render: (level: string) => (
        <Tag color={riskLevelColor[level]}>{level.toUpperCase()}</Tag>
      ),
    },
    {
      title: '风险评分',
      dataIndex: 'riskScore',
      key: 'riskScore',
      render: (score: number) => (
        <Progress
          percent={score}
          strokeColor={score > 70 ? '#f5222d' : score > 40 ? '#faad14' : '#52c41a'}
          format={(percent) => `${(percent ?? 0).toFixed(0)}`}
          size="small"
        />
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
  ] as any[];

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
      render: (level: string) => (
        <Tag color={riskLevelColor[level]}>{level.toUpperCase()}</Tag>
      ),
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
  ] as any[];

  const tableData: RiskRecord[] = assessments.map((a) => ({
    key: a.id,
    ...a,
  }));

  const eventTableData = events.map((e) => ({
    key: e.id,
    ...e,
  }));

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
            <Button icon={<ExclamationCircleOutlined />} onClick={() => handleHealthCheck('comprehensive')}>
              全面检查
            </Button>
            <Button icon={<WarningOutlined />} type="primary" onClick={() => setAssessModalOpen(true)}>
              风险评估
            </Button>
          </Space>
        </div>

        {/* Summary Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总评估数"
                value={status?.totalAssessments || 0}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="评估中"
                value={status?.pendingAssessments || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="高风险"
                value={status?.highRiskCount || 0}
                valueStyle={{ color: '#f5222d' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="未确认事件"
                value={events.length}
                valueStyle={{ color: events.length > 0 ? '#f5222d' : '#52c41a' }}
                prefix={events.length > 0 ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
              />
            </Card>
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

        {/* Assessment Table */}
        <Card title="风险评估记录" style={{ marginBottom: 24 }}>
          <Table
            columns={columns}
            dataSource={tableData}
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
                <Descriptions.Item label="目标类型">{selectedAssessment.targetType}</Descriptions.Item>
                <Descriptions.Item label="目标 ID">{selectedAssessment.targetId}</Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  <Tag color={riskLevelColor[selectedAssessment.riskLevel]}>
                    {selectedAssessment.riskLevel.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="风险评分">{selectedAssessment.riskScore.toFixed(0)}</Descriptions.Item>
                <Descriptions.Item label="状态">{selectedAssessment.status}</Descriptions.Item>
                <Descriptions.Item label="评估者">{selectedAssessment.assessedBy}</Descriptions.Item>
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
                    color={factor.status === 'pass' ? 'green' : factor.status === 'warning' ? 'orange' : 'red'}
                  >
                    <div>
                      <Text strong>{factor.name}</Text>
                      <div style={{ fontSize: 12, color: '#999' }}>{factor.category}</div>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary">{factor.description}</Text>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Text>评分：{factor.score} | 权重：{factor.weight}</Text>
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
