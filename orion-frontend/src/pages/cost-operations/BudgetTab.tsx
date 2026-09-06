/**
 * Budget Tab
 * 预算管理 Tab（抽取自 CostOperationsPage.tsx）
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
  Row,
  Col,
  Modal,
  Alert,
  message,
} from 'antd';
import { spacing } from '@/tokens';
import { ReloadOutlined, PlusOutlined, SafetyOutlined } from '@ant-design/icons';
import {
  getBudgets,
  createBudget,
  deleteBudget,
  checkBudgetGate,
  type BudgetConfig,
} from '@/api/cost-operations';
import { periodMap } from './constants';

const { Text } = Typography;

export const BudgetTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<BudgetConfig[]>([]);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gateForm] = Form.useForm();
  const [gateLoading, setGateLoading] = useState(false);
  const [gateResult, setGateResult] = useState<{
    passed: boolean;
    reason: string;
    estimated: number;
    limit: number;
  } | null>(null);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const res = await getBudgets();
      setBudgets(res.data?.budgets || []);
    } catch (error: unknown) {
      message.error(`加载预算失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createBudget({
        name: values.name,
        amount: values.amount,
        period: values.period,
        services: values.services
          ? (values.services as string).split(',').map((s: string) => s.trim())
          : [],
        alerts: [
          { thresholdPercent: values.alertThreshold, action: values.alertAction, recipients: [] },
        ],
      });
      message.success('预算已创建');
      setModalVisible(false);
      form.resetFields();
      loadBudgets();
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (budgetId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      onOk: async () => {
        try {
          await deleteBudget(budgetId);
          message.success('预算已删除');
          loadBudgets();
        } catch (error: unknown) {
          message.error(`删除失败: ${(error as Error).message}`);
        }
      },
    });
  };

  const handleCheckGate = async () => {
    try {
      const values = await gateForm.validateFields();
      setGateLoading(true);
      const res = await checkBudgetGate(values.pipelineId, values.estimatedCost);
      const data = res.data;
      setGateResult({
        passed: !data?.wouldExceed,
        reason: data?.reason || '预算检查通过',
        estimated: data?.estimatedCost || values.estimatedCost,
        limit: data?.budgetLimit || 0,
      });
    } catch (error: unknown) {
      if (!(error as { errorFields?: unknown }).errorFields) {
        message.error(`预算门禁检查失败: ${(error as Error).message}`);
      }
    } finally {
      setGateLoading(false);
    }
  };

  const budgetColumns = [
    {
      title: '预算名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '周期',
      dataIndex: 'period',
      key: 'period',
      width: 80,
      render: (v: string) => periodMap[v] || v,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '关联服务',
      key: 'services',
      render: (_: unknown, record: BudgetConfig) =>
        record.services.length > 0 ? (
          <Space wrap>
            {record.services.slice(0, 3).map((s: string, i: number) => (
              <Tag key={String(i)}>{s}</Tag>
            ))}
            {record.services.length > 3 && <Tag>+{record.services.length - 3}</Tag>}
          </Space>
        ) : (
          <Text type="secondary">全部</Text>
        ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: BudgetConfig) => (
        <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      {/* Budget Gate Check */}
      <Card
        title={
          <span>
            <SafetyOutlined /> 预算门禁检查
          </span>
        }
      >
        <Form form={gateForm} layout="inline" onFinish={handleCheckGate}>
          <Form.Item name="pipelineId" label="Pipeline ID" rules={[{ required: true }]}>
            <Input placeholder="如: main-build" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="estimatedCost" label="预估成本 (元)" rules={[{ required: true }]}>
            <Input type="number" placeholder="100.00" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={gateLoading}
              icon={<SafetyOutlined />}
            >
              检查
            </Button>
          </Form.Item>
        </Form>

        {gateResult && (
          <Alert
            style={{ marginTop: spacing.md }}
            message={gateResult.passed ? '预算检查通过' : '预算检查未通过'}
            description={`${gateResult.reason} (预估: ¥${gateResult.estimated.toFixed(2)}, 预算: ¥${gateResult.limit.toFixed(2)})`}
            type={gateResult.passed ? 'success' : 'error'}
            showIcon
          />
        )}
      </Card>

      {/* Budgets List */}
      <div>
        <div
          style={
            {
              marginBottom: spacing.md,
              display: 'flex',
              justifyContent: 'space-between',
            } as React.CSSProperties
          }
        >
          <Text type="secondary">配置和管理预算</Text>
          <Space>
            <Button icon={<ReloadOutlined />}  onClick={loadBudgets} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              创建预算
            </Button>
          </Space>
        </div>
        <Table
          columns={budgetColumns}
          dataSource={budgets}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 10 }}
        />
      </div>

      {/* Create Budget Modal */}
      <Modal
        title="创建预算"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="预算名称" rules={[{ required: true }]}>
            <Input placeholder="如: 2026 Q2 预算" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="预算金额 (元)" rules={[{ required: true }]}>
                <Input type="number" placeholder="10000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="period"
                label="周期"
                rules={[{ required: true }]}
                initialValue="monthly"
              >
                <Select
                  options={[
                    { label: '月度', value: 'monthly' },
                    { label: '季度', value: 'quarterly' },
                    { label: '年度', value: 'yearly' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="services" label="关联服务 (逗号分隔, 留空表示全部)">
            <Input placeholder="如: api-service, web-service" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="alertThreshold" label="告警阈值 (%)" initialValue={80}>
                <Input type="number" min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="alertAction" label="告警动作" initialValue="notify">
                <Select
                  options={[
                    { label: '通知', value: 'notify' },
                    { label: '警告', value: 'warn' },
                    { label: '阻断', value: 'block' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
};
