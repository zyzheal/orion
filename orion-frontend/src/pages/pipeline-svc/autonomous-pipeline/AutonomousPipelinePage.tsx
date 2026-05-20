/**
 * AutonomousPipelinePage (Phase 2)
 * 自治流水线页 - 错误分类、自适应超时、重试统计
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
  Form,
  Input,
  Select,
  message,
  Descriptions,
  Statistic,
  Row,
  Col,
  Progress,
} from 'antd';
import {
  RobotOutlined,
  ClockCircleOutlined,
  RedoOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import {
  getErrorStats,
  classifyError,
  getTimeoutForStage,
  recordExecution,
  getRetryStats,
  configureRetry,
  type ErrorClassification,
  type ErrorStats,
  type TimeoutConfig,
  type RetryStats,
  type RetryConfig,
} from '@/api/autonomous-pipeline';

const { Title, Text } = Typography;

// ---- Color maps ----

const categoryColorMap: Record<string, string> = {
  infrastructure: 'blue',
  application: 'purple',
  network: 'orange',
  timeout: 'gold',
  permission: 'red',
  unknown: 'default',
};

const severityColorMap: Record<string, string> = {
  low: 'success',
  medium: 'warning',
  high: 'orange',
  critical: 'error',
};

// ---- Error Classification Tab ----

const ErrorClassificationTab: React.FC = () => {
  const [_loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [classifyForm] = Form.useForm();
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [lastClassification, setLastClassification] = useState<ErrorClassification | null>(null);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await getErrorStats({ days: 7 });
      setStats(res.data?.data || null);
    } catch (error: unknown) {
      message.error(`加载错误统计失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleClassify = async () => {
    try {
      const values = await classifyForm.validateFields();
      setClassifyLoading(true);
      const res = await classifyError({
        pipelineId: values.pipelineId || 'demo-pipeline',
        runId: values.runId || 'demo-run',
        stageName: values.stageName,
        errorMessage: values.errorMessage,
        errorCode: values.errorCode,
      });
      setLastClassification(res.data?.data || null);
      message.success('错误分类完成');
      loadStats();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`错误分类失败: ${(error as Error).message}`);
      }
    } finally {
      setClassifyLoading(false);
    }
  };

  const topErrorsColumns = [
    {
      title: '错误代码',
      dataIndex: 'errorCode',
      key: 'errorCode',
      width: 120,
    },
    {
      title: '错误信息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string) => <Tag color={categoryColorMap[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      render: (v: number) => <Text strong>{v}</Text>,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Stats Cards */}
      {stats && (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="错误总数"
                value={stats.total}
                prefix={<WarningOutlined style={{ color: colors.error[400] }} />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="可重试比例"
                value={stats.retryablePercent}
                suffix="%"
                valueStyle={{ color: colors.success[500] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="高/严重"
                value={(stats.bySeverity?.high || 0) + (stats.bySeverity?.critical || 0)}
                valueStyle={{ color: colors.error[400] }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="错误类别数"
                value={Object.keys(stats.byCategory || {}).length}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Error Classification Form */}
      <Card title="错误分类器">
        <Form form={classifyForm} layout="vertical" onFinish={handleClassify}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="stageName" label="Stage 名称" rules={[{ required: true }]}>
                <Input placeholder="如: build, test, deploy" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="errorCode" label="错误代码">
                <Input placeholder="如: E001, TIMEOUT_001" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pipelineId" label="Pipeline ID">
                <Input placeholder="默认: demo-pipeline" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="errorMessage" label="错误信息" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="粘贴完整的错误日志..." />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={classifyLoading} icon={<RobotOutlined />}>
              分类错误
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Last Classification Result */}
      {lastClassification && (
        <Card title="分类结果">
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="错误类别">
              <Tag color={categoryColorMap[lastClassification.category]}>
                {lastClassification.category}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="严重程度">
              <Tag color={severityColorMap[lastClassification.severity]}>
                {lastClassification.severity}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="是否可重试">
              <Tag color={lastClassification.isRetryable ? 'success' : 'default'}>
                {lastClassification.isRetryable ? '可重试' : '不可重试'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="置信度">
              <Progress
                percent={Math.round(lastClassification.confidence * 100)}
                size="small"
                style={{ width: 100 }}
              />
            </Descriptions.Item>
            <Descriptions.Item label="建议操作" span={2}>
              {lastClassification.suggestedAction}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Top Errors Table */}
      {stats && stats.topErrors && stats.topErrors.length > 0 && (
        <Card title="Top 错误排行">
          <Table
            columns={topErrorsColumns}
            dataSource={stats.topErrors}
            rowKey="errorCode"
            size="small"
            pagination={false}
          />
        </Card>
      )}
    </Space>
  );
};

// ---- Adaptive Timeout Tab ----

const AdaptiveTimeoutTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [timeoutConfig, setTimeoutConfig] = useState<TimeoutConfig | null>(null);
  const [stageName, setStageName] = useState('');
  const [executionForm] = Form.useForm();
  const [recordLoading, setRecordLoading] = useState(false);

  const loadTimeout = async () => {
    if (!stageName) {
      message.warning('请输入 Stage 名称');
      return;
    }
    setLoading(true);
    try {
      const res = await getTimeoutForStage(stageName);
      setTimeoutConfig(res.data?.data || null);
    } catch (error: unknown) {
      message.error(`加载超时配置失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordExecution = async () => {
    try {
      const values = await executionForm.validateFields();
      setRecordLoading(true);
      await recordExecution({
        pipelineId: values.pipelineId || 'demo-pipeline',
        stageName: values.stageName,
        durationMs: values.durationMs,
        status: values.status,
      });
      message.success('执行数据已记录');
      executionForm.resetFields();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`记录执行数据失败: ${(error as Error).message}`);
      }
    } finally {
      setRecordLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Query Timeout */}
      <Card title="自适应超时配置">
        <Space>
          <Input
            placeholder="Stage 名称 (如: build, test, deploy)"
            style={{ width: 300 }}
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            onPressEnter={loadTimeout}
          />
          <Button
            type="primary"
            icon={<ClockCircleOutlined />}
            onClick={loadTimeout}
            loading={loading}
          >
            查询建议超时
          </Button>
        </Space>
      </Card>

      {timeoutConfig && (
        <Card title={`超时配置: ${timeoutConfig.stageName}`}>
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="建议超时"
                  value={timeoutConfig.suggestedTimeoutMs}
                  suffix="ms"
                  valueStyle={{ color: colors.primary[500] }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="历史平均" value={timeoutConfig.historicalAvgMs} suffix="ms" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="P95" value={timeoutConfig.percentile95Ms} suffix="ms" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="P99" value={timeoutConfig.percentile99Ms} suffix="ms" />
              </Card>
            </Col>
          </Row>
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">样本数: {timeoutConfig.sampleSize}</Text>
          </div>
        </Card>
      )}

      {/* Record Execution */}
      <Card title="记录执行数据">
        <Form form={executionForm} layout="vertical" onFinish={handleRecordExecution}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="stageName" label="Stage 名称" rules={[{ required: true }]}>
                <Input placeholder="如: build" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="durationMs" label="执行时间 (ms)" rules={[{ required: true }]}>
                <Input type="number" placeholder="5000" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="执行状态" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '成功', value: 'success' },
                    { label: '失败', value: 'failure' },
                    { label: '超时', value: 'timeout' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="pipelineId" label="Pipeline ID">
                <Input placeholder="默认: demo-pipeline" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={recordLoading}>
              记录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
};

// ---- Auto Retry Tab ----

const AutoRetryTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [retryStats, setRetryStats] = useState<RetryStats | null>(null);
  const [pipelineId, setPipelineId] = useState('');
  const [retryForm] = Form.useForm();
  const [retryConfigLoading, setRetryConfigLoading] = useState(false);

  const loadRetryStats = async () => {
    if (!pipelineId) {
      message.warning('请输入 Pipeline ID');
      return;
    }
    setLoading(true);
    try {
      const res = await getRetryStats(pipelineId);
      setRetryStats(res.data?.data || null);
    } catch (error: unknown) {
      message.error(`加载重试统计失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureRetry = async () => {
    try {
      const values = await retryForm.validateFields();
      setRetryConfigLoading(true);
      const payload: RetryConfig = {
        pipelineId: values.pipelineId,
        maxRetries: values.maxRetries,
        backoffMultiplier: values.backoffMultiplier,
        initialDelayMs: values.initialDelayMs,
        maxDelayMs: values.maxDelayMs,
        retryableErrors: (values.retryableErrors as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean),
      };
      await configureRetry(payload);
      message.success('重试策略配置成功');
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`配置重试策略失败: ${(error as Error).message}`);
      }
    } finally {
      setRetryConfigLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Retry Stats */}
      <Card title="重试统计">
        <Space>
          <Input
            placeholder="Pipeline ID"
            style={{ width: 260 }}
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            onPressEnter={loadRetryStats}
          />
          <Button
            type="primary"
            icon={<RedoOutlined />}
            onClick={loadRetryStats}
            loading={loading}
          >
            查询重试统计
          </Button>
        </Space>
      </Card>

      {retryStats && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col span={6}>
              <Card>
                <Statistic title="总重试次数" value={retryStats.totalRetries} prefix={<RedoOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="重试成功率"
                  value={retryStats.successRate}
                  suffix="%"
                  valueStyle={{ color: colors.success[500] }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="成功重试" value={retryStats.successfulRetries} valueStyle={{ color: colors.success[500] }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="失败重试" value={retryStats.failedRetries} valueStyle={{ color: colors.error[400] }} />
              </Card>
            </Col>
          </Row>

          {retryStats.history && retryStats.history.length > 0 && (
            <Card title="重试历史趋势">
              <Table
                dataSource={retryStats.history}
                rowKey="date"
                size="small"
                pagination={false}
                columns={[
                  { title: '日期', dataIndex: 'date', key: 'date' },
                  { title: '重试次数', dataIndex: 'retries', key: 'retries' },
                  { title: '成功次数', dataIndex: 'successes', key: 'successes', render: (v: number) => <Text style={{ color: colors.success[500] }}>{v}</Text> },
                  {
                    title: '成功率',
                    key: 'rate',
                    render: (_: unknown, record: { retries: number; successes: number }) => (
                      <Progress
                        percent={record.retries > 0 ? Math.round((record.successes / record.retries) * 100) : 0}
                        size="small"
                        style={{ width: 100 }}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          )}
        </Space>
      )}

      {/* Configure Retry */}
      <Card title="配置重试策略">
        <Form form={retryForm} layout="vertical" onFinish={handleConfigureRetry}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="pipelineId" label="Pipeline ID" rules={[{ required: true }]}>
                <Input placeholder="如: main-build" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="maxRetries" label="最大重试次数" rules={[{ required: true }]} initialValue={3}>
                <Input type="number" min={0} max={10} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="backoffMultiplier" label="退避倍数" initialValue={2}>
                <Input type="number" min={1} step={0.5} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="initialDelayMs" label="初始延迟 (ms)" initialValue={1000}>
                <Input type="number" min={100} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={4}>
              <Form.Item name="maxDelayMs" label="最大延迟 (ms)" initialValue={30000}>
                <Input type="number" min={1000} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="retryableErrors" label="可重试错误代码 (逗号分隔)">
                <Input placeholder="如: TIMEOUT, NETWORK_ERROR, E500" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={retryConfigLoading} icon={<RedoOutlined />}>
              保存重试策略
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
};

// ---- Main Page ----

const AutonomousPipelinePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('errors');

  useEffect(() => {
    const timer = setTimeout(() => {}, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, marginBottom: 8, display: 'flex', alignItems: 'center' }}>
          <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          自治流水线
        </Title>
        <Text type="secondary">错误分类、自适应超时配置和自动重试管理</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane
          tab={
            <span>
              <WarningOutlined />
              错误分类
            </span>
          }
          key="errors"
        >
          <ErrorClassificationTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <ClockCircleOutlined />
              自适应超时
            </span>
          }
          key="timeout"
        >
          <AdaptiveTimeoutTab />
        </Tabs.TabPane>
        <Tabs.TabPane
          tab={
            <span>
              <RedoOutlined />
              自动重试
            </span>
          }
          key="retry"
        >
          <AutoRetryTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default AutonomousPipelinePage;
