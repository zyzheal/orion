/**
 * Chaos Engineering Page
 * Phase 3 - Chaos experiments dashboard with resilience score tracking
 *
 * Features:
 * - Resilience score dashboard with progress indicators
 * - Chaos experiment management (create, run, monitor)
 * - Fault injection configuration
 * - Experiment history and results
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  Tag,
  Statistic,
  Row,
  Col,
  Progress,
  message,
  Space,
  InputNumber,
  Descriptions,
  Drawer,
  Alert,
  Typography,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  SafetyOutlined,
  ReloadOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import {
  chaosApi,
  resilienceApi,
  ChaosExperiment,
  ChaosFault,
  ResilienceScore,
} from '../../../api/chaos';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

// Fault type config
const faultTypeConfig: Record<string, { label: string; color: string }> = {
  network_latency: { label: '网络延迟', color: 'orange' },
  service_down: { label: '服务下线', color: 'red' },
  cpu_stress: { label: 'CPU 压力', color: 'magenta' },
  memory_stress: { label: '内存压力', color: 'purple' },
  disk_full: { label: '磁盘填充', color: 'gold' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  active: { label: '就绪', color: 'green' },
  completed: { label: '已完成', color: 'blue' },
  archived: { label: '已归档', color: 'gold' },
};

const envConfig: Record<string, { label: string; color: string }> = {
  staging: { label: '预发环境', color: 'blue' },
  production: { label: '生产环境', color: 'red' },
};

const ChaosEngineering: React.FC = () => {
  const [experiments, setExperiments] = useState<ChaosExperiment[]>([]);
  const [score, setScore] = useState<ResilienceScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<ChaosExperiment | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expResponse, scoreData] = await Promise.all([
        chaosApi.listExperiments(),
        resilienceApi.getScore(),
      ]);
      setExperiments(expResponse.data || []);
      setScore(scoreData);
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '未知错误';
      setError(`加载数据失败: ${errorMsg}`);
      message.error(`加载数据失败: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunExperiment = async (experimentId: string) => {
    setRunningId(experimentId);
    setRunError(null);
    try {
      await chaosApi.runExperiment(experimentId);
      message.success('混沌实验已启动');
      loadData();
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || '未知错误';
      setRunError(`启动实验失败: ${errorMsg}`);
      message.error(`启动实验失败: ${errorMsg}`);
    } finally {
      setRunningId(null);
    }
  };

  const handleCreateExperiment = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        description: values.description,
        scope: {
          tenant_id: 'default',
          service_id: values.serviceId || undefined,
          environment: values.environment,
        },
        faults: values.faultTypes.map((type: string) => ({
          type: type as ChaosFault['type'],
          target: values.serviceId || '*',
          config: {
            duration_ms: (values.duration || 60) * 1000,
            severity: values.severity || 'medium',
          },
          duration_ms: (values.duration || 60) * 1000,
          delay_ms: 0,
        })),
        steadyStateHypothesis: values.steadyState ? { description: values.steadyState } : undefined,
      };
      await chaosApi.createExperiment(payload);
      message.success('混沌实验创建成功');
      setCreateModal(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (exp: ChaosExperiment) => {
    setSelectedExperiment(exp);
    setDetailDrawer(true);
  };

  // Stats
  const stats = React.useMemo(
    () => ({
      total: experiments.length,
      active: experiments.filter((e) => e.status === 'active').length,
      completed: experiments.filter((e) => e.status === 'completed').length,
      archived: experiments.filter((e) => e.status === 'archived').length,
    }),
    [experiments]
  );

  // Table columns
  const columns: ColumnsType<ChaosExperiment> = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string, record) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => openDetail(record)}
          >
            <ExperimentOutlined style={{ marginRight: 6 }} />
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description?.substring(0, 40) || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: '环境',
      dataIndex: 'scope',
      key: 'environment',
      width: 100,
      render: (scope: { environment?: string }) => {
        const env = scope?.environment || 'staging';
        const cfg = envConfig[env] || envConfig.staging;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const cfg = statusConfig[status] || statusConfig.draft;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '故障类型',
      dataIndex: 'faults',
      key: 'faults',
      width: 200,
      render: (faults: Array<{ type: string }>) => (
        <Space wrap>
          {(faults || []).slice(0, 3).map((f, i) => {
            const cfg = faultTypeConfig[f.type] || { label: f.type, color: 'default' };
            return (
              <Tag key={i} color={cfg.color}>
                {cfg.label}
              </Tag>
            );
          })}
          {(faults || []).length > 3 && <Tag>+{(faults || []).length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: ChaosExperiment) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title="运行实验">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                loading={runningId === record.id}
                onClick={() => handleRunExperiment(record.id)}
              />
            </Tooltip>
          )}
        </Space>
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
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            混沌工程
          </Title>
          <Text type="secondary">故障注入实验与系统弹性测试</Text>
        </div>
        <Space>
          {error && (
            <Button danger size="small" onClick={() => setError(null)}>
              清除错误提示
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Error display */}
      {error && (
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* Run error display */}
      {runError && (
        <Alert
          message="实验运行失败"
          description={runError}
          type="error"
          showIcon
          closable
          onClose={() => setRunError(null)}
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* Resilience Score */}
      <Card
        title={
          <>
            <SafetyOutlined style={{ marginRight: spacing.sm }} />
            系统弹性评分
          </>
        }
        style={{ marginBottom: spacing.lg }}
      >
        <Row gutter={24}>
          <Col span={6}>
            <Statistic title="弹性评分" value={score?.score ?? 0} suffix="/ 100" />
            <Progress
              percent={score?.score ?? 0}
              status={
                score && score.score >= 80
                  ? 'success'
                  : score && score.score >= 60
                    ? 'normal'
                    : 'exception'
              }
              style={{ marginTop: spacing.sm }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均恢复时间 (MTTR)"
              value={score?.mttr_ms ?? 0}
              suffix="ms"
              valueStyle={{
                color: score && score.mttr_ms < 5000 ? colors.success[500] : colors.warning[500],
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="实验成功率"
              value={(score?.success_rate ?? 0) * 100}
              precision={1}
              suffix="%"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="趋势"
              value={score?.trend || 'stable'}
              valueStyle={{
                color:
                  score?.trend === 'improving'
                    ? colors.success[500]
                    : score?.trend === 'degrading'
                      ? colors.error[400]
                      : colors.neutral[400],
              }}
            />
          </Col>
        </Row>
      </Card>

      {/* Experiment Stats */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="实验总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="就绪"
              value={stats.active}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已归档"
              value={stats.archived}
              valueStyle={{ color: colors.neutral[400] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: colors.neutral[400] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Warning for production experiments */}
      {experiments.some((e) => e.scope?.environment === 'production' && e.status === 'active') && (
        <Alert
          message="注意"
          description="存在生产环境的混沌实验，执行前请确认影响范围"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      {/* Experiments Table */}
      <Card
        title={
          <>
            <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
            混沌实验列表
          </>
        }
        extra={
          <Space>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                form.resetFields();
                setCreateModal(true);
              }}
            >
              创建实验
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={experiments}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Create Experiment Modal */}
      <Modal
        title={
          <>
            <ExperimentOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
            创建混沌实验
          </>
        }
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        destroyOnClose
      >
        <Alert
          message="混沌实验将在指定环境中注入故障"
          description="请确保实验范围正确，生产环境实验需要额外审批"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
        <Form form={form} layout="vertical" onFinish={handleCreateExperiment}>
          <Form.Item
            name="name"
            label="实验名称"
            rules={[{ required: true, message: '请输入实验名称' }]}
          >
            <Input placeholder="如: API 服务延迟注入实验" />
          </Form.Item>
          <Form.Item name="description" label="实验描述">
            <Input.TextArea rows={2} placeholder="描述实验目的和预期效果..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="environment"
                label="目标环境"
                rules={[{ required: true, message: '请选择环境' }]}
              >
                <Select
                  options={[
                    { value: 'staging', label: '预发环境' },
                    { value: 'production', label: '生产环境（需要审批）' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serviceId" label="目标服务 (可选)">
                <Input placeholder="如: api-service" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="faultTypes"
            label="故障类型"
            rules={[{ required: true, message: '请选择至少一种故障类型' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择故障注入类型"
              options={Object.entries(faultTypeConfig).map(([k, v]) => ({
                value: k,
                label: v.label,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="duration" label="故障持续时间 (秒)" initialValue={60}>
                <InputNumber min={10} max={600} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label="严重程度" initialValue="medium">
                <Select
                  options={[
                    { value: 'low', label: '低' },
                    { value: 'medium', label: '中' },
                    { value: 'high', label: '高' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="labels" label="目标标签 (JSON, 可选)">
            <Input.TextArea rows={2} placeholder='如: {"app": "api-service"}' />
          </Form.Item>
          <Form.Item name="steadyState" label="稳态假设 (可选)">
            <Input.TextArea rows={2} placeholder="描述系统在故障注入前应具备的稳态特征..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedExperiment?.name || '实验详情'}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        width={720}
        destroyOnClose
      >
        {selectedExperiment && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="实验名称" span={2}>
                {selectedExperiment.name}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const cfg = statusConfig[selectedExperiment.status] || statusConfig.draft;
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="环境">
                {(() => {
                  const env = selectedExperiment.scope?.environment || 'staging';
                  const cfg = envConfig[env] || envConfig.staging;
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="目标服务">
                {selectedExperiment.scope?.service_id || '全部服务'}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedExperiment.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Faults */}
            <Card size="small" title="故障配置">
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {(selectedExperiment.faults || []).map((f: any, i: number) => {
                  const cfg = faultTypeConfig[f.type] || { label: f.type, color: 'default' };
                  return (
                    <div key={i}>
                      <Tag color={cfg.color}>{cfg.label}</Tag>
                      <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                        持续 {f.duration || 60}s | 严重程度 {f.severity || 'medium'}
                      </Text>
                    </div>
                  );
                })}
              </Space>
            </Card>

            {/* Actions */}
            {selectedExperiment.status === 'active' && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runningId === selectedExperiment.id}
                onClick={() => handleRunExperiment(selectedExperiment.id)}
              >
                运行实验
              </Button>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default ChaosEngineering;
