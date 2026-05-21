/**
 * Pipeline Budget Page
 * Budget configuration, usage monitoring, cost estimation
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Descriptions,
  Progress,
  Row,
  Col,
  Statistic,
  Tag,
  Table as AntTable,
} from 'antd';
import {
  ReloadOutlined,
  DollarOutlined,
  SettingOutlined,
  LineChartOutlined,
  CalculatorOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import pipelineBudgetApi from '@/api/pipeline-budget';
import type { BudgetConfig, BudgetUsage, BudgetAlert, BudgetEstimate } from '@/api/pipeline-budget';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ---- Color / label maps ----

const policyColorMap: Record<string, string> = {
  warn: 'orange',
  block: 'red',
  rollback: 'red',
};

const policyLabelMap: Record<string, string> = {
  warn: '警告',
  block: '阻止',
  rollback: '回滚',
};

const levelColorMap: Record<string, string> = {
  warning: 'orange',
  critical: 'red',
};

const levelLabelMap: Record<string, string> = {
  warning: '警告',
  critical: '严重',
};

const typeLabelMap: Record<string, string> = {
  time: '时间',
  cpu: 'CPU',
  memory: '内存',
  cost: '成本',
};

// ---- Format helpers ----

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatCost = (cents: number): string => {
  return `¥${(cents / 100).toFixed(2)}`;
};

// ---- Usage Card Component ----

const UsageCard: React.FC<{
  title: string;
  used: number;
  percent: number;
  unit: string;
  icon: React.ReactNode;
}> = ({ title, used, percent, unit, icon }) => {
  const statusColor = percent >= 90 ? 'exception' : percent >= 70 ? 'normal' : 'success';
  const strokeColor = percent >= 90 ? '#ff4d4f' : percent >= 70 ? '#faad14' : '#52c41a';

  return (
    <Card size="small">
      <Statistic
        title={title}
        value={percent.toFixed(1)}
        suffix="%"
        prefix={icon}
        valueStyle={{ color: strokeColor, fontSize: 24 }}
      />
      <Progress
        percent={Math.min(percent, 100)}
        status={statusColor}
        strokeColor={strokeColor}
        size="small"
        style={{ marginTop: 8 }}
      />
      <Text type="secondary" style={{ fontSize: 12 }}>
        已用: {used}{unit}
      </Text>
    </Card>
  );
};

// ---- Main Component ----

const PipelineBudgetPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('pipeline-demo-1');
  const [selectedRunId, setSelectedRunId] = useState<string>('run-demo-1');

  // Budget config
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configForm] = Form.useForm();
  const [savingConfig, setSavingConfig] = useState(false);

  // Budget usage
  const [budgetUsage, setBudgetUsage] = useState<BudgetUsage | null>(null);

  // Budget estimate
  const [budgetEstimate, setBudgetEstimate] = useState<BudgetEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [selectedTriggerType, setSelectedTriggerType] = useState<string>('manual');

  // Alerts
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);

  const loadBudgetConfig = async () => {
    setLoading(true);
    try {
      const res = await pipelineBudgetApi.get(selectedPipelineId);
      setBudgetConfig(res || null);
    } catch (error: unknown) {
      setBudgetConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const loadBudgetUsage = async () => {
    try {
      const res = await pipelineBudgetApi.getUsage(selectedPipelineId, selectedRunId);
      setBudgetUsage(res || null);
      setAlerts(res?.alerts || []);
    } catch (error: unknown) {
      setBudgetUsage(null);
      setAlerts([]);
    }
  };

  const loadEstimate = async () => {
    setEstimateLoading(true);
    try {
      const res = await pipelineBudgetApi.estimate(selectedPipelineId, selectedTriggerType);
      setBudgetEstimate(res || null);
    } catch (error: unknown) {
      setBudgetEstimate(null);
      message.error(`预估失败: ${(error as Error).message}`);
    } finally {
      setEstimateLoading(false);
    }
  };

  useEffect(() => {
    loadBudgetConfig();
    loadBudgetUsage();
  }, [selectedPipelineId, selectedRunId]);

  const openConfigModal = () => {
    if (budgetConfig) {
      configForm.setFieldsValue({
        maxDurationMs: budgetConfig.time_budget?.maxDurationMs || 3600000,
        timeWarningPercent: budgetConfig.time_budget?.warningPercent || 80,
        timePolicy: budgetConfig.time_budget?.policy || 'warn',
        maxCpuCoreHours: budgetConfig.resource_budget?.maxCpuCoreHours || 100,
        maxMemoryGBHours: budgetConfig.resource_budget?.maxMemoryGBHours || 200,
        resourceWarningPercent: budgetConfig.resource_budget?.warningPercent || 80,
        resourcePolicy: budgetConfig.resource_budget?.policy || 'warn',
        maxCostCents: budgetConfig.cost_budget?.maxCostCents || 10000,
        costWarningPercent: budgetConfig.cost_budget?.warningPercent || 80,
        costPolicy: budgetConfig.cost_budget?.policy || 'warn',
      });
    } else {
      configForm.setFieldsValue({
        maxDurationMs: 3600000,
        timeWarningPercent: 80,
        timePolicy: 'warn',
        maxCpuCoreHours: 100,
        maxMemoryGBHours: 200,
        resourceWarningPercent: 80,
        resourcePolicy: 'warn',
        maxCostCents: 10000,
        costWarningPercent: 80,
        costPolicy: 'warn',
      });
    }
    setConfigModalVisible(true);
  };

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      setSavingConfig(true);
      const config: BudgetConfig = {
        time_budget: {
          maxDurationMs: Number(values.maxDurationMs),
          warningPercent: Number(values.timeWarningPercent),
          policy: values.timePolicy,
        },
        resource_budget: {
          maxCpuCoreHours: Number(values.maxCpuCoreHours),
          maxMemoryGBHours: Number(values.maxMemoryGBHours),
          warningPercent: Number(values.resourceWarningPercent),
          policy: values.resourcePolicy,
        },
        cost_budget: {
          maxCostCents: Number(values.maxCostCents),
          warningPercent: Number(values.costWarningPercent),
          policy: values.costPolicy,
        },
      };
      await pipelineBudgetApi.set(selectedPipelineId, config);
      message.success('预算配置保存成功');
      setConfigModalVisible(false);
      loadBudgetConfig();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`保存失败: ${(error as Error).message}`);
      }
    } finally {
      setSavingConfig(false);
    }
  };

  // ---- Alerts table ----

  const alertColumns: ColumnsType<BudgetAlert> = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => <Tag>{typeLabelMap[v] || v}</Tag>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: string) => <Tag color={levelColorMap[v]}>{levelLabelMap[v] || v}</Tag>,
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      width: 180,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? dayjs(String(v)).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      ),
    },
  ];

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
            流水线预算
          </Title>
          <Text type="secondary">配置和执行流水线的预算限制，监控资源使用</Text>
        </div>
        <Space>
          <Select
            value={selectedPipelineId}
            onChange={setSelectedPipelineId}
            style={{ width: 240 }}
            options={[
              { label: 'Demo Pipeline 1', value: 'pipeline-demo-1' },
              { label: 'Build & Test Pipeline', value: 'pipeline-demo-2' },
            ]}
          />
          <Select
            value={selectedRunId}
            onChange={setSelectedRunId}
            style={{ width: 200 }}
            options={[
              { label: 'Run #101', value: 'run-demo-1' },
              { label: 'Run #102', value: 'run-demo-2' },
              { label: 'Run #103', value: 'run-demo-3' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { loadBudgetConfig(); loadBudgetUsage(); }} loading={loading}>
            刷新
          </Button>
          <Button icon={<SettingOutlined />} onClick={openConfigModal}>
            预算配置
          </Button>
        </Space>
      </div>

      {/* Usage Monitor Cards */}
      {budgetUsage && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <UsageCard
              title="时间预算"
              used={budgetUsage.time_used}
              percent={budgetUsage.time_percent}
              unit="ms"
              icon={<LineChartOutlined />}
            />
          </Col>
          <Col span={6}>
            <UsageCard
              title="CPU 预算"
              used={budgetUsage.cpu_used}
              percent={budgetUsage.cpu_percent}
              unit=" core-h"
              icon={<LineChartOutlined />}
            />
          </Col>
          <Col span={6}>
            <UsageCard
              title="内存预算"
              used={budgetUsage.memory_used}
              percent={budgetUsage.memory_percent}
              unit=" GB-h"
              icon={<LineChartOutlined />}
            />
          </Col>
          <Col span={6}>
            <UsageCard
              title="成本预算"
              used={budgetUsage.cost_used}
              percent={budgetUsage.cost_percent}
              unit=" ¥"
              icon={<LineChartOutlined />}
            />
          </Col>
        </Row>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card title={<><WarningOutlined style={{ marginRight: 8 }} />预算告警</>} style={{ marginBottom: 24 }}>
          <AntTable<BudgetAlert>
            columns={alertColumns}
            dataSource={alerts}
            rowKey={(_, i) => `alert-${i}`}
            size="small"
            pagination={false}
          />
        </Card>
      )}

      {/* Budget Config Summary */}
      {budgetConfig && (
        <Card title="当前预算配置" style={{ marginBottom: 24 }}>
          <Descriptions column={3} bordered size="small">
            <Descriptions.Item label="最大执行时间">
              {formatDuration(budgetConfig.time_budget?.maxDurationMs || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="时间告警阈值">
              {budgetConfig.time_budget?.warningPercent}%
              <Tag color={policyColorMap[budgetConfig.time_budget?.policy || 'warn']} style={{ marginLeft: 8 }}>
                {policyLabelMap[budgetConfig.time_budget?.policy || 'warn']}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最大 CPU 核时">
              {budgetConfig.resource_budget?.maxCpuCoreHours || 0} core-h
            </Descriptions.Item>
            <Descriptions.Item label="最大内存">
              {budgetConfig.resource_budget?.maxMemoryGBHours || 0} GB-h
            </Descriptions.Item>
            <Descriptions.Item label="资源告警阈值">
              {budgetConfig.resource_budget?.warningPercent}%
              <Tag color={policyColorMap[budgetConfig.resource_budget?.policy || 'warn']} style={{ marginLeft: 8 }}>
                {policyLabelMap[budgetConfig.resource_budget?.policy || 'warn']}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最大成本">
              {formatCost(budgetConfig.cost_budget?.maxCostCents || 0)}
            </Descriptions.Item>
            <Descriptions.Item label="成本告警阈值">
              {budgetConfig.cost_budget?.warningPercent}%
              <Tag color={policyColorMap[budgetConfig.cost_budget?.policy || 'warn']} style={{ marginLeft: 8 }}>
                {policyLabelMap[budgetConfig.cost_budget?.policy || 'warn']}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Budget Estimate */}
      <Card
        title={<><CalculatorOutlined style={{ marginRight: 8 }} />预算预估</>}
        extra={
          <Space>
            <Select
              value={selectedTriggerType}
              onChange={setSelectedTriggerType}
              style={{ width: 140 }}
              options={[
                { label: '手动触发', value: 'manual' },
                { label: '代码推送', value: 'push' },
                { label: '定时触发', value: 'schedule' },
              ]}
            />
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={loadEstimate}
              loading={estimateLoading}
            >
              执行预估
            </Button>
          </Space>
        }
      >
        {budgetEstimate ? (
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="预估时间"
                value={formatDuration(budgetEstimate.estimatedTimeMs)}
                suffix={<Tag color="blue">置信度 {(budgetEstimate.confidence * 100).toFixed(0)}%</Tag>}
              />
            </Col>
            <Col span={6}>
              <Statistic title="预估 CPU" value={budgetEstimate.estimatedCpuCores.toFixed(1)} suffix="cores" />
            </Col>
            <Col span={6}>
              <Statistic title="预估内存" value={budgetEstimate.estimatedMemoryGB.toFixed(1)} suffix="GB" />
            </Col>
            <Col span={6}>
              <Statistic title="预估成本" value={formatCost(budgetEstimate.estimatedCost)} />
            </Col>
          </Row>
        ) : (
          <Text type="secondary">选择触发类型后点击"执行预估"获取预算预估值</Text>
        )}
      </Card>

      {/* Config Modal */}
      <Modal
        title="预算配置"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={handleSaveConfig}
        confirmLoading={savingConfig}
        width={700}
        destroyOnClose
      >
        <Form form={configForm} layout="vertical">
          <Title level={5}>时间预算</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="maxDurationMs" label="最大执行时间 (毫秒)">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="timeWarningPercent" label="告警阈值 (%)">
                <Input type="number" min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="timePolicy" label="超限策略">
                <Select options={[
                  { label: '警告', value: 'warn' },
                  { label: '阻止', value: 'block' },
                  { label: '回滚', value: 'rollback' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5}>资源预算</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="maxCpuCoreHours" label="最大 CPU 核时">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxMemoryGBHours" label="最大内存 GB-h">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="resourcePolicy" label="超限策略">
                <Select options={[
                  { label: '警告', value: 'warn' },
                  { label: '阻止', value: 'block' },
                  { label: '回滚', value: 'rollback' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Title level={5}>成本预算</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="maxCostCents" label="最大成本 (分)">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="costWarningPercent" label="告警阈值 (%)">
                <Input type="number" min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="costPolicy" label="超限策略">
                <Select options={[
                  { label: '警告', value: 'warn' },
                  { label: '阻止', value: 'block' },
                  { label: '回滚', value: 'rollback' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default PipelineBudgetPage;
