/**
 * Pipeline Budget Page
 * Phase 1 - Budget configuration and monitoring UI
 *
 * Features:
 * - Budget configuration (time, cost, compute)
 * - Real-time budget usage tracking
 * - Budget alerts and history
 * - Form validation and loading states
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Card,
  Form,
  InputNumber,
  Select,
  Button,
  Progress,
  Statistic,
  Row,
  Col,
  Alert,
  message,
  Typography,
  Space,
  Tag,
  Descriptions,
  Spin,
} from 'antd';
import {
  DollarOutlined,
  ClockCircleOutlined,
  CloudOutlined,
  ReloadOutlined,
  SaveOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { pipelineBudgetApi, BudgetConfig, BudgetUsage } from '../../api/pipeline-budget';

const { Title, Text } = Typography;

// Alert level config
const alertLevelConfig: Record<
  string,
  { label: string; color: string; type: 'success' | 'info' | 'warning' | 'error' }
> = {
  info: { label: '提示', color: 'blue', type: 'info' },
  warning: { label: '警告', color: 'orange', type: 'warning' },
  critical: { label: '严重', color: 'red', type: 'error' },
  resolved: { label: '已解决', color: 'green', type: 'success' },
};

const policyLabelMap: Record<string, string> = {
  warn: '仅警告',
  block: '阻断执行',
  rollback: '回滚',
};

const PipelineBudget: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId') || undefined;
  const [config, setConfig] = useState<BudgetConfig | null>(null);
  const [usage, setUsage] = useState<BudgetUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadBudget();
  }, [pipelineId, runId]);

  const loadBudget = async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const budgetConfig = await pipelineBudgetApi.get(pipelineId);
      setConfig(budgetConfig || {});
      form.setFieldsValue(budgetConfig || {});
      // Load usage data if runId is available
      if (runId) {
        await loadUsage(runId);
      } else {
        setUsage(null);
      }
    } catch (error: unknown) {
      message.error(`加载预算配置失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUsage = async (rid: string) => {
    if (!pipelineId || !rid) return;
    try {
      const usageData = await pipelineBudgetApi.getUsage(pipelineId, rid);
      setUsage(usageData);
    } catch (error: unknown) {
      message.error(`加载预算使用数据失败: ${(error as Error).message}`);
    }
  };

  const handleSave = async (values: BudgetConfig) => {
    if (!pipelineId) return;
    setSaving(true);
    try {
      await pipelineBudgetApi.set(pipelineId, values);
      message.success('预算配置已保存');
      loadBudget();
    } catch (error: unknown) {
      message.error(`保存失败: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      form.setFieldsValue(config);
      message.info('已重置为上次保存的配置');
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
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
            <DollarOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            <DollarOutlined style={{ marginRight: 8 }} />
            流水线预算
          </Title>
          <Text type="secondary">配置和管理流水线的资源预算限制</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadBudget} loading={loading}>
          刷新
        </Button>
      </div>

      {!pipelineId && (
        <Alert
          message="未指定 Pipeline ID"
          description="请在 URL 中包含 pipelineId 参数，例如: /pipelines/xxx/budget"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={24}>
        {/* Left: Budget Configuration */}
        <Col span={14}>
          <Spin spinning={loading}>
            <Card
              title={
                <>
                  <SaveOutlined style={{ marginRight: 8 }} />
                  预算配置
                </>
              }
              extra={
                <Space>
                  <Button onClick={handleReset} disabled={!config}>
                    重置
                  </Button>
                </Space>
              }
            >
              <Form form={form} layout="vertical" onFinish={handleSave}>
                {/* Time Budget */}
                <Card
                  type="inner"
                  title={
                    <>
                      <ClockCircleOutlined style={{ marginRight: 6 }} />
                      时间预算
                    </>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="最大执行时长 (分钟)"
                        name={['time_budget', 'maxDurationMs']}
                        rules={[{ required: true, message: '请输入最大时长' }]}
                        getValueFromEvent={(e: any) => (typeof e === 'number' ? e * 60 * 1000 : e)}
                        getValueProps={(value: any) => ({
                          value: value ? Math.round(value / 60000) : undefined,
                        })}
                      >
                        <InputNumber
                          min={1}
                          max={120}
                          style={{ width: '100%' }}
                          placeholder="如: 30"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="警告阈值 (%)"
                        name={['time_budget', 'warningPercent']}
                        rules={[{ required: true, message: '请输入警告阈值' }]}
                      >
                        <InputNumber
                          min={50}
                          max={100}
                          style={{ width: '100%' }}
                          placeholder="如: 80"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label="超时策略"
                    name={['time_budget', 'policy']}
                    rules={[{ required: true, message: '请选择超时策略' }]}
                  >
                    <Select
                      options={[
                        { value: 'warn', label: '仅警告 - 记录警告但不中断' },
                        { value: 'block', label: '阻断执行 - 超过预算后阻止运行' },
                        { value: 'rollback', label: '回滚 - 超时后自动回滚' },
                      ]}
                    />
                  </Form.Item>
                </Card>

                {/* Cost Budget */}
                <Card
                  type="inner"
                  title={
                    <>
                      <DollarOutlined style={{ marginRight: 6 }} />
                      成本预算
                    </>
                  }
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="最大成本 (元)"
                        name={['cost_budget', 'maxCostCents']}
                        rules={[{ required: true, message: '请输入最大成本' }]}
                      >
                        <InputNumber
                          min={0}
                          precision={2}
                          style={{ width: '100%' }}
                          placeholder="如: 100.00"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="警告阈值 (%)"
                        name={['cost_budget', 'warningPercent']}
                        rules={[{ required: true, message: '请输入警告阈值' }]}
                      >
                        <InputNumber
                          min={50}
                          max={100}
                          style={{ width: '100%' }}
                          placeholder="如: 80"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    label="超支策略"
                    name={['cost_budget', 'policy']}
                    rules={[{ required: true, message: '请选择超支策略' }]}
                  >
                    <Select
                      options={[
                        { value: 'warn', label: '仅警告 - 记录警告但不中断' },
                        { value: 'block', label: '阻断执行 - 超过预算后阻止运行' },
                      ]}
                    />
                  </Form.Item>
                </Card>

                {/* Compute Budget */}
                <Card
                  type="inner"
                  title={
                    <>
                      <CloudOutlined style={{ marginRight: 6 }} />
                      计算资源预算
                    </>
                  }
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="最大 CPU 核心数" name={['compute_budget', 'maxCpu']}>
                        <InputNumber
                          min={0.1}
                          max={64}
                          style={{ width: '100%' }}
                          placeholder="如: 4"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="最大内存 (GB)" name={['compute_budget', 'maxMemoryGb']}>
                        <InputNumber
                          min={0.5}
                          max={128}
                          style={{ width: '100%' }}
                          placeholder="如: 8"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* Submit */}
                <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                  <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                    保存配置
                  </Button>
                </div>
              </Form>
            </Card>
          </Spin>
        </Col>

        {/* Right: Budget Usage */}
        <Col span={10}>
          <Spin spinning={loading}>
            <Card
              title={
                <>
                  <BarChartOutlined style={{ marginRight: 8 }} />
                  预算使用情况
                </>
              }
            >
              {/* Alerts */}
              {usage?.alerts && usage.alerts.length > 0 && (
                <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size={8}>
                  {usage.alerts.map((alert: any, i: number) => {
                    const cfg = alertLevelConfig[alert.level] || alertLevelConfig.info;
                    return (
                      <Alert
                        key={i}
                        message={cfg.label}
                        description={alert.message}
                        type={cfg.type}
                        showIcon
                        icon={
                          alert.level === 'critical' ? <WarningOutlined /> : <CheckCircleOutlined />
                        }
                      />
                    );
                  })}
                </Space>
              )}

              {usage?.alerts?.length === 0 && (
                <Alert
                  message="预算使用正常"
                  description="当前未触发任何预算告警"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              {/* Usage Stats */}
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic title="时间使用" value={usage?.time_percent ?? 0} suffix="%" />
                  <Progress
                    percent={usage?.time_percent ?? 0}
                    status={
                      usage && usage.time_percent > 80
                        ? 'exception'
                        : usage && usage.time_percent > 60
                          ? 'normal'
                          : 'success'
                    }
                    style={{ marginTop: 8 }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic title="成本使用" value={usage?.cost_percent ?? 0} suffix="%" />
                  <Progress
                    percent={usage?.cost_percent ?? 0}
                    status={
                      usage && usage.cost_percent > 80
                        ? 'exception'
                        : usage && usage.cost_percent > 60
                          ? 'normal'
                          : 'success'
                    }
                    style={{ marginTop: 8 }}
                  />
                </Col>
              </Row>

              {/* Budget Summary */}
              {config && (
                <Descriptions column={1} size="small" style={{ marginTop: 16 }} bordered>
                  <Descriptions.Item label="时间预算">
                    {config.time_budget?.maxDurationMs
                      ? `${Math.round(config.time_budget.maxDurationMs / 60000)} 分钟`
                      : '未配置'}
                  </Descriptions.Item>
                  <Descriptions.Item label="时间策略">
                    {config.time_budget?.policy ? (
                      <Tag color={config.time_budget.policy === 'block' ? 'red' : 'blue'}>
                        {policyLabelMap[config.time_budget.policy] || config.time_budget.policy}
                      </Tag>
                    ) : (
                      '未配置'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="成本预算">
                    {config.cost_budget?.maxCostCents
                      ? `¥${(config.cost_budget.maxCostCents / 100).toFixed(2)}`
                      : '未配置'}
                  </Descriptions.Item>
                  <Descriptions.Item label="成本策略">
                    {config.cost_budget?.policy ? (
                      <Tag color={config.cost_budget.policy === 'block' ? 'red' : 'blue'}>
                        {policyLabelMap[config.cost_budget.policy] || config.cost_budget.policy}
                      </Tag>
                    ) : (
                      '未配置'
                    )}
                  </Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Spin>
        </Col>
      </Row>
    </div>
  );
};

export default PipelineBudget;
