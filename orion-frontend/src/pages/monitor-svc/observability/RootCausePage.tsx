/**
 * RootCausePage - RCA Analysis Dashboard
 * Phase 2: 根因分析、依赖图、时间线、时间关联分析
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Table, Tag, Space, Button, Form, Input,
  message, Descriptions, Row, Col, Timeline, Drawer,
  Divider, Statistic, Tabs, List, Alert,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, BranchesOutlined,
  ClockCircleOutlined, EyeOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import {
  getRootCauseAnalyses, getRootCauseAnalysis, triggerRCA,
  getRcaTimeline, getDependencyGraph, analyzeDependencyRootCause,
  analyzeTemporalCorrelation,
  type RootCauseAnalysis, type TimelineEvent,
  type ServiceDependency, type TemporalCorrelationResult,
} from '@/api/observability';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

const statusColorMap: Record<string, string> = {
  analyzing: 'processing',
  completed: 'success',
  failed: 'error',
  partial: 'warning',
};

const depTypeColorMap: Record<string, string> = {
  sync: 'blue',
  async: 'green',
  database: 'orange',
  cache: 'purple',
  external: 'default',
};

// ---- Dependency Graph Tab ----

const DependencyGraphTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deps, setDeps] = useState<ServiceDependency[]>([]);
  const [affectedServices, setAffectedServices] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string[]>([]);

  const loadGraph = async () => {
    setLoading(true);
    try {
      const res = await getDependencyGraph();
      const rawData = res.data?.data;
      setDeps(Array.isArray(rawData) ? rawData : (rawData?.data as ServiceDependency[]) || []);
    } catch (error: unknown) {
      message.error(`加载依赖图失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const handleAnalyze = async () => {
    if (!affectedServices) {
      message.warning('请输入受影响的服务列表');
      return;
    }
    try {
      const services = affectedServices.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await analyzeDependencyRootCause(services);
      const rawData = res.data?.data;
      setAnalysisResult(Array.isArray(rawData) ? rawData : (rawData?.data as string[]) || []);
      message.success('根因分析完成');
    } catch (error: unknown) {
      message.error(`分析失败: ${(error as Error).message}`);
    }
  };

  const columns = [
    { title: '服务名称', dataIndex: 'service', key: 'service', width: 180, render: (v: string) => <Text strong>{v}</Text> },
    {
      title: '依赖类型',
      dataIndex: 'dependencyType',
      key: 'dependencyType',
      width: 100,
      render: (v: string) => <Tag color={depTypeColorMap[v]}>{v}</Tag>,
    },
    {
      title: '依赖服务',
      dataIndex: 'dependsOn',
      key: 'dependsOn',
      render: (deps: string[]) => (
        <Space wrap>
          {deps.map((d) => <Tag key={d} color="blue">{d}</Tag>)}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Analysis Input */}
      <Card title="基于依赖图的根因分析">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input
              placeholder="输入受影响的服务（逗号分隔），如: api-gateway, auth-service"
              value={affectedServices}
              onChange={(e) => setAffectedServices(e.target.value)}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleAnalyze}>分析根因</Button>
          </Col>
        </Row>
        {analysisResult.length > 0 && (
          <Alert
            message="分析结果"
            description={
              <Space wrap>
                <Text>最可能的根因服务：</Text>
                {analysisResult.map((s) => <Tag key={s} color="error">{s}</Tag>)}
              </Space>
            }
            type="info"
            style={{ marginTop: 12 }}
          />
        )}
      </Card>

      {/* Dependency Table */}
      <Card title="服务依赖关系">
        <div style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={loadGraph} loading={loading}>刷新</Button>
        </div>
        <Table columns={columns} dataSource={deps} rowKey="service" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
      </Card>
    </Space>
  );
};

// ---- Temporal Correlation Tab ----

const TemporalCorrelationTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TemporalCorrelationResult | null>(null);
  const [alertsJson, setAlertsJson] = useState('');

  const handleAnalyze = async () => {
    if (!alertsJson) {
      message.warning('请输入告警 JSON 数据');
      return;
    }
    try {
      const alerts = JSON.parse(alertsJson);
      setLoading(true);
      const res = await analyzeTemporalCorrelation(alerts);
      const rawData = res.data?.data;
      setResult(rawData as unknown as TemporalCorrelationResult || null);
      message.success('时间关联分析完成');
    } catch (error: unknown) {
      message.error(`分析失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="时间关联分析">
        <Text type="secondary">
          分析在特定时间窗口内聚集的告警，识别告警爆发（burst）
        </Text>
        <Divider />
        <Form layout="vertical">
          <Form.Item label="告警数据（JSON 格式）">
            <Input.TextArea
              rows={6}
              placeholder={`[
  {"id": "a1", "name": "CPU High", "service": "api-gateway", "severity": "critical", "firedAt": "2026-05-05T10:00:00Z", "message": "..."}
]`}
              value={alertsJson}
              onChange={(e) => setAlertsJson(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<ClockCircleOutlined />} onClick={handleAnalyze} loading={loading}>
              分析时间关联
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {result && (
        <Card title="分析结果">
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="关联告警数" value={result.correlatedAlerts.length} />
            </Col>
            <Col span={8}>
              <Statistic title="时间窗口内告警数" value={result.timeCluster.alertCount} />
            </Col>
            <Col span={8}>
              <Statistic
                title="告警爆发检测"
                value={result.burstDetected ? '是' : '否'}
                valueStyle={{ color: result.burstDetected ? colors.error[400] : colors.success[500] }}
              />
            </Col>
          </Row>
          <Divider />
          <List
            dataSource={result.correlatedAlerts}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<Space><Tag color={item.severity === 'critical' ? 'error' : 'warning'}>{item.severity}</Tag>{item.name}</Space>}
                  description={
                    <Space direction="vertical">
                      <Text>服务: {item.service}</Text>
                      <Text type="secondary">{item.correlationReason}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </Space>
  );
};

// ---- Timeline Tab ----

const TimelineTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deploymentId, setDeploymentId] = useState('');
  const [timeline, setTimeline] = useState<{
    events: TimelineEvent[];
    totalEvents: number;
    criticalEvents: number;
  } | null>(null);
  const [form] = Form.useForm();

  const loadTimeline = async () => {
    if (!deploymentId) {
      message.warning('请输入部署 ID');
      return;
    }
    setLoading(true);
    try {
      const res = await getRcaTimeline(deploymentId);
      const t = (res.data as { timeline?: { events?: unknown[]; totalEvents?: number; criticalEvents?: number } })?.timeline ?? res.data?.data;
      if (t) {
        setTimeline({
          events: t.events || [],
          totalEvents: t.totalEvents || 0,
          criticalEvents: t.criticalEvents || 0,
        });
      }
    } catch (error: unknown) {
      message.error(`加载时间线失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (severity: string) => {
    switch (severity) {
      case 'critical': return colors.error[400];
      case 'warning': return colors.warning[400];
      default: return colors.info[400];
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="部署时间线">
        <Form form={form} layout="inline" onFinish={loadTimeline}>
          <Form.Item name="deploymentId" label="部署 ID" rules={[{ required: true }]}>
            <Input
              placeholder="如: deploy-001"
              style={{ width: 240 }}
              value={deploymentId}
              onChange={(e) => setDeploymentId(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SearchOutlined />}>
              加载时间线
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {timeline && (
        <Card title={`时间线事件 (${timeline.totalEvents} 个事件, ${timeline.criticalEvents} 个严重)}`}>
          <Timeline>
            {timeline.events.map((event, i) => (
              <Timeline.Item key={i} color={getEventColor(event.severity)}>
                <Text strong>{event.service}</Text>
                <Tag style={{ marginLeft: 8 }}>{event.eventType}</Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {new Date(event.timestamp).toLocaleString()}
                </Text>
                <div style={{ marginTop: 4 }}>{event.description}</div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}
    </Space>
  );
};

// ---- RCA Analysis Tab ----

const RCAAnalysisTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState<RootCauseAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [triggerForm] = Form.useForm();
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const res = await getRootCauseAnalyses();
      setAnalyses(res.data?.data?.analyses || []);
    } catch (error: unknown) {
      message.error(`加载根因分析列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  const handleTrigger = async () => {
    try {
      const values = await triggerForm.validateFields();
      setTriggerLoading(true);
      await triggerRCA({
        incidentId: values.incidentId,
        serviceIds: values.serviceIds
          ? (values.serviceIds as string).split(',').map((s: string) => s.trim())
          : undefined,
      });
      message.success('根因分析已触发');
      triggerForm.resetFields();
      loadAnalyses();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`触发失败: ${(error as Error).message}`);
      }
    } finally {
      setTriggerLoading(false);
    }
  };

  const viewDetail = async (analysis: RootCauseAnalysis) => {
    setSelectedAnalysis(analysis);
    setDrawerVisible(true);
    setDetailLoading(true);
    try {
      const res = await getRootCauseAnalysis(analysis.id);
      setSelectedAnalysis(res.data?.data || analysis);
    } catch {
      // fallback to existing data
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { title: '事件 ID', dataIndex: 'incidentId', key: 'incidentId', width: 140 },
    { title: '开始时间', dataIndex: 'startTime', key: 'startTime', width: 160, render: (v: string) => new Date(v).toLocaleString() },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    {
      title: '根因服务',
      key: 'rootCause',
      width: 140,
      render: (_: unknown, record: RootCauseAnalysis) => record.rootCause?.service || '-',
    },
    {
      title: '置信度',
      key: 'confidence',
      width: 100,
      render: (_: unknown, record: RootCauseAnalysis) =>
        record.rootCause ? `${Math.round(record.rootCause.confidence * 100)}%` : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: RootCauseAnalysis) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="触发根因分析">
        <Form form={triggerForm} layout="inline" onFinish={handleTrigger}>
          <Form.Item name="incidentId" label="事件 ID" rules={[{ required: true }]}>
            <Input placeholder="如: INC-001" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="serviceIds" label="涉及服务 (逗号分隔)">
            <Input placeholder="如: api-gateway, auth-service" style={{ width: 280 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={triggerLoading} icon={<SearchOutlined />}>
              触发分析
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="根因分析列表">
        <div style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={loadAnalyses} loading={loading}>刷新</Button>
        </div>
        <Table columns={columns} dataSource={analyses} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10 }} />
      </Card>

      <Drawer
        title="根因分析详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={800}
      >
        {detailLoading ? (
          <PageSkeleton rows={4} />
        ) : selectedAnalysis ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="事件 ID">{selectedAnalysis.incidentId}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedAnalysis.status]}>{selectedAnalysis.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{new Date(selectedAnalysis.startTime).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {selectedAnalysis.endTime ? new Date(selectedAnalysis.endTime).toLocaleString() : '进行中'}
              </Descriptions.Item>
            </Descriptions>

            {selectedAnalysis.rootCause && (
              <Card size="small" title="根因" style={{ borderLeft: `3px solid ${colors.error[400]}` }}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="服务">{selectedAnalysis.rootCause.service}</Descriptions.Item>
                  <Descriptions.Item label="组件">{selectedAnalysis.rootCause.component}</Descriptions.Item>
                  <Descriptions.Item label="描述">{selectedAnalysis.rootCause.description}</Descriptions.Item>
                  <Descriptions.Item label="置信度">
                    <Tag color={selectedAnalysis.rootCause.confidence > 0.7 ? 'success' : 'warning'}>
                      {Math.round(selectedAnalysis.rootCause.confidence * 100)}%
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {selectedAnalysis.timeline && selectedAnalysis.timeline.length > 0 && (
              <Card size="small" title="事件时间线">
                <Timeline>
                  {selectedAnalysis.timeline.map((item, i) => (
                    <Timeline.Item key={i}>
                      <Text strong>{item.service}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Text>
                      <div>{item.event}</div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}

            {selectedAnalysis.recommendations && selectedAnalysis.recommendations.length > 0 && (
              <Card size="small" title="建议措施">
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {selectedAnalysis.recommendations.map((r, i) => (
                    <li key={i}><Text>{r}</Text></li>
                  ))}
                </ul>
              </Card>
            )}
          </Space>
        ) : (
          <Text type="secondary">无法加载分析详情</Text>
        )}
      </Drawer>
    </Space>
  );
};

// ---- Main Page ----

const RootCausePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rca');

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          根因分析中心
        </Title>
        <Text type="secondary">
          根因分析、服务依赖图分析、时间线追踪和时间关联分析
        </Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab={<span><SearchOutlined />根因分析</span>} key="rca">
          <RCAAnalysisTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><BranchesOutlined />依赖图</span>} key="dependency">
          <DependencyGraphTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><ClockCircleOutlined />时间线</span>} key="timeline">
          <TimelineTab />
        </Tabs.TabPane>
        <Tabs.TabPane tab={<span><ThunderboltOutlined />时间关联</span>} key="temporal">
          <TemporalCorrelationTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default RootCausePage;
