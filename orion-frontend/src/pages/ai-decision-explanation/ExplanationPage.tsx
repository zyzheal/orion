/**
 * ExplanationPage (Phase 2)
 * AI 决策解释页 - 查看决策解释、特征重要性、规则匹配路径和历史记录
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Form,
  Input,
  Select,
  message,
  Descriptions,
  Progress,
  Row,
  Col,
  Tabs,
  Timeline,
} from 'antd';
import {
  InfoCircleOutlined,
  SearchOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import {
  explainDecision,
  getExplanationById,
  getExplanationHistory,
  type ExplanationWithRules,
  type MatchedRule,
} from '@/api/ai-decision';

const { Title, Text } = Typography;

// ---- Color maps ----

const decisionColorMap: Record<string, string> = {
  pass: 'success',
  fail: 'error',
  warn: 'warning',
  manual_review: 'processing',
};

const directionColorMap: Record<string, string> = {
  positive: colors.success[500],
  negative: colors.error[400],
  neutral: colors.neutral[400],
};

const confidenceLevelMap: Record<string, string> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
  very_low: 'default',
};

// ---- Explain Decision Tab ----

const ExplainDecisionTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<ExplanationWithRules | null>(null);
  const [form] = Form.useForm();

  const handleExplain = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const features = (values.features as string)
        .split(',')
        .map((s: string) => ({
          name: s.trim(),
          value: Math.random(),
          weight: values.weight ? parseFloat(values.weight) : undefined,
        }))
        .filter((f: { name: string }) => f.name);

      const res = await explainDecision({
        decisionId: values.decisionId || `decision-${Date.now()}`,
        decisionType: values.decisionType,
        decision: values.decision,
        features,
        confidence: values.confidence ? parseFloat(values.confidence) : undefined,
      });
      setExplanation(res.data?.data || null);
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
                    { label: '代码审查 (code-review)', value: 'code-review' },
                    { label: '风险评估 (risk-assessment)', value: 'risk-assessment' },
                    { label: '测试选择 (test-selection)', value: 'test-selection' },
                    { label: '诊断 (diagnosis)', value: 'diagnosis' },
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="features" label="特征名称 (逗号分隔)">
                <Input placeholder="如: code_complexity, test_coverage, security_issues" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="weight" label="特征权重">
                <Input type="number" min={0} max={1} step={0.1} placeholder="0.2" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="decisionId" label="决策 ID (可选)">
                <Input placeholder="自动生成" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<InfoCircleOutlined />}>
              生成解释
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {explanation && (
        <>
          <Card title="决策解释结果">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="决策类型">{explanation.decisionType}</Descriptions.Item>
              <Descriptions.Item label="决策结果">
                <Tag color={decisionColorMap[explanation.decision]}>
                  {explanation.decision}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                <Progress
                  percent={Math.round(explanation.confidence * 100)}
                  size="small"
                  style={{ width: 120 }}
                  strokeColor={
                    explanation.confidence >= 0.8
                      ? colors.success[500]
                      : explanation.confidence >= 0.6
                      ? colors.warning[500]
                      : colors.error[400]
                  }
                />
              </Descriptions.Item>
              <Descriptions.Item label="置信度等级">
                <Tag color={confidenceLevelMap[explanation.confidence >= 0.8 ? 'high' : explanation.confidence >= 0.6 ? 'medium' : 'low']}>
                  {explanation.confidence >= 0.8 ? 'high' : explanation.confidence >= 0.6 ? 'medium' : 'low'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="解释说明" span={2}>
                {explanation.explanation}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 特征重要性 */}
          {explanation.factors && explanation.factors.length > 0 && (
            <Card title="特征重要性 (SHAP 风格)">
              <Table
                dataSource={explanation.factors}
                rowKey="name"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: '特征',
                    dataIndex: 'name',
                    key: 'name',
                    width: 180,
                    render: (v: string) => <Text strong>{v}</Text>,
                  },
                  {
                    title: '重要性',
                    dataIndex: 'importance',
                    key: 'importance',
                    width: 140,
                    render: (v: number) => {
                      const abs = Math.abs(v);
                      return (
                        <Progress
                          percent={Math.round(abs * 100)}
                          size="small"
                          style={{ width: 120 }}
                          strokeColor={directionColorMap[v > 0.05 ? 'positive' : v < -0.05 ? 'negative' : 'neutral']}
                          format={() => v.toFixed(3)}
                        />
                      );
                    },
                  },
                  {
                    title: '方向',
                    dataIndex: 'direction',
                    key: 'direction',
                    width: 100,
                    render: (v: string) => (
                      <Tag color={v === 'positive' ? 'success' : v === 'negative' ? 'error' : 'default'}>
                        {v}
                      </Tag>
                    ),
                  },
                  { title: '说明', dataIndex: 'description', key: 'description' },
                ]}
              />
            </Card>
          )}

          {/* 规则匹配路径 */}
          {explanation.matchedRules && explanation.matchedRules.length > 0 && (
            <Card title="规则匹配路径">
              <Table
                dataSource={explanation.matchedRules}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: '规则',
                    dataIndex: 'name',
                    key: 'name',
                    width: 180,
                  },
                  {
                    title: '条件',
                    dataIndex: 'condition',
                    key: 'condition',
                  },
                  {
                    title: '是否匹配',
                    dataIndex: 'matched',
                    key: 'matched',
                    width: 100,
                    render: (v: boolean) =>
                      v ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>匹配</Tag>
                      ) : (
                        <Tag color="default" icon={<CloseCircleOutlined />}>未匹配</Tag>
                      ),
                  },
                  {
                    title: '贡献度',
                    dataIndex: 'contribution',
                    key: 'contribution',
                    width: 120,
                    render: (v: number) => (v !== undefined ? v.toFixed(2) : '-'),
                  },
                ]}
              />
            </Card>
          )}

          {/* 建议 */}
          {explanation.matchedRules && explanation.matchedRules.some((r) => r.contribution !== undefined) && (
            <Card title="建议贡献度" size="small">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {explanation.matchedRules.filter((r) => r.contribution !== undefined).map((r, i) => (
                  <li key={i}>
                    <Text>{r.name}: 贡献 {r.contribution?.toFixed(2)}</Text>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </Space>
  );
};

// ---- Explanation History Tab ----

const ExplanationHistoryTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ExplanationWithRules[]>([]);
  const [detail, setDetail] = useState<ExplanationWithRules | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>();

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await getExplanationHistory({
        limit: 50,
        decisionType: filterType,
      });
      setHistory(res.data?.data || []);
    } catch (error: unknown) {
      message.error(`加载历史失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await getExplanationById(id);
      setDetail(res.data?.data || null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchId) {
      message.warning('请输入解释 ID');
      return;
    }
    setDetailLoading(true);
    try {
      const res = await getExplanationById(searchId);
      setDetail(res.data?.data || null);
      if (!res.data?.data) {
        message.info('未找到该解释');
      }
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const historyColumns = [
    {
      title: '决策 ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (v: string) => (
        <Text
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => loadDetail(v)}
        >
          {v}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'decisionType',
      key: 'decisionType',
      width: 140,
    },
    {
      title: '结果',
      dataIndex: 'decision',
      key: 'decision',
      width: 120,
      render: (v: string) => <Tag color={decisionColorMap[v]}>{v}</Tag>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 120,
      render: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Row gutter={16}>
        <Col span={12}>
          <Card title="搜索解释">
            <Space>
              <Input
                placeholder="输入解释 ID"
                style={{ width: 300 }}
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onPressEnter={handleSearch}
              />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="过滤">
            <Space>
              <Select
                style={{ width: 200 }}
                placeholder="决策类型"
                allowClear
                value={filterType}
                onChange={setFilterType}
                options={[
                  { label: 'code-review', value: 'code-review' },
                  { label: 'risk-assessment', value: 'risk-assessment' },
                  { label: 'test-selection', value: 'test-selection' },
                  { label: 'diagnosis', value: 'diagnosis' },
                ]}
              />
              <Button icon={<ReloadOutlined />} onClick={loadHistory} loading={loading}>
                刷新
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 详情 */}
      {detailLoading ? (
        <Card><PageSkeleton rows={4} /></Card>
      ) : detail ? (
        <Card title={`解释详情: ${detail.id}`}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="类型">{detail.decisionType}</Descriptions.Item>
            <Descriptions.Item label="结果">
              <Tag color={decisionColorMap[detail.decision]}>{detail.decision}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="置信度">{(detail.confidence * 100).toFixed(1)}%</Descriptions.Item>
            <Descriptions.Item label="时间">{new Date(detail.createdAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="理由" span={2}>{detail.explanation}</Descriptions.Item>
          </Descriptions>

          {detail.matchedRules && detail.matchedRules.length > 0 && (
            <Card size="small" title="规则匹配" style={{ marginTop: 16 }}>
              <Timeline>
                {detail.matchedRules.map((rule: MatchedRule) => (
                  <Timeline.Item
                    key={rule.id}
                    color={rule.matched ? 'green' : 'gray'}
                  >
                    <Text strong>{rule.name}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {rule.condition}
                    </Text>
                    {rule.contribution !== undefined && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        贡献: {rule.contribution.toFixed(2)}
                      </Text>
                    )}
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          )}
        </Card>
      ) : null}

      {/* 历史列表 */}
      <Card title="解释历史">
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Space>
  );
};

// ---- Main Page ----

const ExplanationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('explain');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <PageSkeleton rows={6} />;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          AI 决策解释
        </Title>
        <Text type="secondary">
          生成 SHAP 风格特征重要性解释，查看规则匹配路径和解释历史
        </Text>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <InfoCircleOutlined /> 生成解释
            </span>
          }
          key="explain"
        >
          <ExplainDecisionTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <HistoryOutlined /> 解释历史
            </span>
          }
          key="history"
        >
          <ExplanationHistoryTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default ExplanationPage;
