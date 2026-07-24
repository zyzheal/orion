/**
 * AIDecisionPage (Phase 2)
 * AI 决策引擎页 - 决策解释、模型版本管理、A/B 测试
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Tabs,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Descriptions,
  Progress,
  Statistic,
  Row,
  Col,
} from 'antd';
import { spacing } from '@/tokens';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  EyeOutlined,
  ExperimentOutlined,
  TrophyOutlined,
  LineChartOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import PageSkeleton from '@/components/PageSkeleton';
import {
  listModels,
  getModelPerformance,
  getABTestResults,
  explainDecision,
  activateModel,
  deprecateModel,
  type ModelVersion,
  type ABTestResult,
  type ModelPerformance,
  type DecisionExplanation,
} from '@/api/ai-decision';

const { Title, Text } = Typography;

// ---- Color maps ----

const statusColorMap: Record<string, string> = {
  active: 'success',
  deprecated: 'default',
  testing: 'processing',
};

const decisionColorMap: Record<string, string> = {
  pass: 'success',
  fail: 'error',
  warn: 'warning',
  manual_review: 'processing',
};

// ---- Model Versions Tab ----

const ModelVersionsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [performance, setPerformance] = useState<ModelPerformance | null>(null);

  const loadModels = async () => {
    setLoading(true);
    try {
      const res = await listModels();
      setModels(res.data?.models || []);
    } catch (error: unknown) {
      message.error(`加载模型列表失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const viewDetail = async (model: ModelVersion) => {
    setSelectedModel(model);
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await getModelPerformance(model.name);
      setPerformance(res.data || null);
    } catch {
      setPerformance(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleActivate = async (modelId: string) => {
    try {
      await activateModel(modelId);
      message.success('模型已激活');
      loadModels();
    } catch (error: unknown) {
      message.error(`激活失败: ${(error as Error).message}`);
    }
  };

  const handleDeprecate = async (modelId: string) => {
    try {
      await deprecateModel(modelId);
      message.success('模型已废弃');
      loadModels();
    } catch (error: unknown) {
      message.error(`废弃失败: ${(error as Error).message}`);
    }
  };

  const columns = [
    {
      title: '模型名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string, record: ModelVersion) => (
        <Space>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => viewDetail(record)}>
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            v{record.version}
          </Text>
        </Space>
      ),
    },
    {
      title: '框架',
      dataIndex: 'framework',
      key: 'framework',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '准确率',
      key: 'accuracy',
      width: 100,
      render: (_: unknown, record: ModelVersion) =>
        `${((record.metrics?.accuracy || 0) * 100).toFixed(1)}%`,
    },
    {
      title: 'F1 Score',
      key: 'f1Score',
      width: 100,
      render: (_: unknown, record: ModelVersion) =>
        `${((record.metrics?.f1Score || 0) * 100).toFixed(1)}%`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: ModelVersion) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>
            详情
          </Button>
          {record.status === 'testing' && (
            <Button
              type="link"
              size="small"
              style={{ color: colors.success[500] }}
              onClick={() => handleActivate(record.id)}
            >
              激活
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleDeprecate(record.id)}
            >
              废弃
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary">管理 AI 模型版本，查看性能和进行 A/B 测试对比</Text>
        <Button icon={<ReloadOutlined />} onClick={loadModels} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={models}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={selectedModel?.name || '模型详情'}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {detailLoading ? (
          <PageSkeleton rows={4} />
        ) : selectedModel ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="名称">{selectedModel.name}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedModel.version}</Descriptions.Item>
              <Descriptions.Item label="框架">{selectedModel.framework}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedModel.status]}>{selectedModel.status}</Tag>
              </Descriptions.Item>
            </Descriptions>

            {performance && (
              <>
                <Title level={5}>性能指标</Title>
                <Row gutter={16}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="总决策数"
                        value={performance.totalDecisions}
                        prefix={<ThunderboltOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="准确率"
                        value={(performance.accuracy * 100).toFixed(1)}
                        suffix="%"
                        valueStyle={{ color: colors.success[500] }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="平均延迟"
                        value={performance.avgLatencyMs}
                        suffix="ms"
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="错误率"
                        value={(performance.errorRate * 100).toFixed(2)}
                        suffix="%"
                        valueStyle={{ color: colors.error[400] }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card size="small" title="趋势数据 (近 7 天)">
                  {performance.dailyTrend.map((d, i) => (
                    <div key={i} style={{ marginBottom: spacing.sm }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12 }}>{d.date}</Text>
                        <Progress
                          percent={Math.round(d.accuracy * 100)}
                          size="small"
                          style={{ width: 200 }}
                          format={() => `${d.decisions} 次决策`}
                        />
                      </Space>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </Space>
        ) : (
          <Text type="secondary">无法加载模型详情</Text>
        )}
      </Modal>
    </div>
  );
};

// ---- A/B Testing Tab ----

const ABTestingTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ABTestResult | null>(null);
  const [modelName, setModelName] = useState('');

  const loadABTest = async () => {
    if (!modelName) {
      message.warning('请输入模型名称');
      return;
    }
    setLoading(true);
    try {
      const res = await getABTestResults(modelName);
      setResults(res.data || null);
    } catch (error: unknown) {
      message.error(`加载 A/B 测试结果失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card size="small">
        <Space>
          <Input
            placeholder="输入模型名称 (如: pipeline-decision)"
            style={{ width: 300 }}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            onPressEnter={loadABTest}
          />
          <Button type="primary" icon={<ExperimentOutlined />} onClick={loadABTest} loading={loading}>
            查询 A/B 测试
          </Button>
        </Space>
      </Card>

      {results && (
        <>
          <Card title="A/B 测试结果对比">
            <Row gutter={16}>
              <Col span={11}>
                <Card
                  title="Variant A"
                  size="small"
                  style={{ borderColor: colors.primary[500] }}
                >
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="模型 ID">{results.variantA.modelId}</Descriptions.Item>
                    <Descriptions.Item label="流量分配">{results.variantA.trafficPercent}%</Descriptions.Item>
                    <Descriptions.Item label="成功率">{(results.variantA.successRate * 100).toFixed(1)}%</Descriptions.Item>
                    <Descriptions.Item label="平均延迟">{results.variantA.avgLatency}ms</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary" style={{ fontSize: 24 }}>VS</Text>
              </Col>
              <Col span={11}>
                <Card
                  title="Variant B"
                  size="small"
                  style={{ borderColor: colors.purple[500] }}
                >
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="模型 ID">{results.variantB.modelId}</Descriptions.Item>
                    <Descriptions.Item label="流量分配">{results.variantB.trafficPercent}%</Descriptions.Item>
                    <Descriptions.Item label="成功率">{(results.variantB.successRate * 100).toFixed(1)}%</Descriptions.Item>
                    <Descriptions.Item label="平均延迟">{results.variantB.avgLatency}ms</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          </Card>

          <Card size="small">
            <Space>
              <Tag color={results.winner === 'A' ? 'blue' : results.winner === 'B' ? 'purple' : 'default'}>
                胜出方: {results.winner === 'inconclusive' ? '无明显胜出' : `Variant ${results.winner}`}
              </Tag>
              <Text type="secondary">置信度: {(results.confidence * 100).toFixed(1)}%</Text>
              <Progress
                percent={Math.round(results.confidence * 100)}
                size="small"
                style={{ width: 120 }}
              />
            </Space>
          </Card>
        </>
      )}

      {!results && !loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <ExperimentOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <Text type="secondary" style={{ display: 'block', marginTop: spacing.md }}>
              输入模型名称并查询 A/B 测试结果
            </Text>
          </div>
        </Card>
      )}
    </Space>
  );
};

// ---- Decision Explanation Tab ----

const DecisionExplanationTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<DecisionExplanation | null>(null);
  const [form] = Form.useForm();

  const handleExplain = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const features = (values.features as string)
        .split(',')
        .map((s: string) => ({ name: s.trim(), value: Math.random() }))
        .filter((f: { name: string }) => f.name);
      const res = await explainDecision({
        decisionId: values.decisionId || 'demo-decision',
        decisionType: values.decisionType,
        decision: values.decision,
        features,
        confidence: values.confidence,
      });
      setExplanation(res.data || null);
      message.success('决策解释已生成');
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`生成解释失败: ${(error as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="生成决策解释">
        <Form form={form} layout="vertical" onFinish={handleExplain}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="decisionType" label="决策类型" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'Pipeline 执行', value: 'pipeline_execution' },
                    { label: '部署决策', value: 'deployment' },
                    { label: '质量门禁', value: 'quality_gate' },
                    { label: '成本门禁', value: 'cost_gate' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="decision" label="决策结果" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '通过 (pass)', value: 'pass' },
                    { label: '拒绝 (fail)', value: 'fail' },
                    { label: '警告 (warn)', value: 'warn' },
                    { label: '人工审查 (manual_review)', value: 'manual_review' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="confidence" label="置信度 (0-1)">
                <Input type="number" min={0} max={1} step={0.01} placeholder="0.85" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="features" label="特征名称 (逗号分隔)">
            <Input placeholder="如: build_duration, test_coverage, error_count" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<InfoCircleOutlined />}>
              生成解释
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {explanation && (
        <Card title="决策解释结果">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="决策类型">{explanation.decisionType}</Descriptions.Item>
            <Descriptions.Item label="决策结果">
              <Tag color={decisionColorMap[explanation.decision]}>{explanation.decision}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="置信度">
              <Progress
                percent={Math.round(explanation.confidence * 100)}
                size="small"
                style={{ width: 120 }}
              />
            </Descriptions.Item>
            <Descriptions.Item label="解释说明" span={2}>
              {explanation.explanation}
            </Descriptions.Item>
          </Descriptions>

          {explanation.factors && explanation.factors.length > 0 && (
            <Card size="small" title="影响因素" style={{ marginTop: spacing.md }}>
              <Table
                dataSource={explanation.factors}
                rowKey="name"
                size="small"
                pagination={false}
                columns={[
                  { title: '因素', dataIndex: 'name', key: 'name' },
                  {
                    title: '重要性',
                    dataIndex: 'importance',
                    key: 'importance',
                    render: (v: number) => <Progress percent={Math.round(v * 100)} size="small" style={{ width: 100 }} />,
                  },
                  {
                    title: '方向',
                    dataIndex: 'direction',
                    key: 'direction',
                    render: (v: string) => (
                      <Tag
                        color={
                          v === 'positive'
                            ? 'success'
                            : v === 'negative'
                              ? 'error'
                              : 'default'
                        }
                      >
                        {v}
                      </Tag>
                    ),
                  },
                  { title: '说明', dataIndex: 'description', key: 'description' },
                ]}
              />
            </Card>
          )}
        </Card>
      )}
    </Space>
  );
};

// ---- Main Page ----

const AIDecisionPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('models');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load indicator
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          AI 决策引擎
        </Title>
        <Text type="secondary">决策解释、模型版本管理和 A/B 测试</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <TrophyOutlined />
              模型版本
            </span>
          }
          key="models"
        >
          <ModelVersionsTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <ExperimentOutlined />
              A/B 测试
            </span>
          }
          key="abtest"
        >
          <ABTestingTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <LineChartOutlined />
              决策解释
            </span>
          }
          key="explanation"
        >
          <DecisionExplanationTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default AIDecisionPage;
