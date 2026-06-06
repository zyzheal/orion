/**
 * Budget Management - Create/edit budgets, budget hierarchy, emergency top-up
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getBudgets,
  createBudget,
  updateBudget,
  restoreBudget,
  deleteBudget,
  type Budget,
  type BudgetInput,
} from '@/api/ai-cost';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

const typeOptions = [
  { label: '租户', value: 'tenant' },
  { label: '项目', value: 'project' },
  { label: '用户', value: 'user' },
  { label: '模型', value: 'model' },
];

const periodOptions = [
  { label: '每日', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '每季度', value: 'quarterly' },
  { label: '每年', value: 'yearly' },
];

const BudgetManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getBudgets();
      setBudgets(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setBudgets([]);
      message.error(`加载预算数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBudgets = useMemo(() => {
    return budgets.filter((b) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!b.name.toLowerCase().includes(q) && !b.scope.toLowerCase().includes(q)) return false;
      }
      if (filters.type && filters.type !== 'all' && b.type !== filters.type) return false;
      if (filters.status && filters.status !== 'all' && b.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, budgets]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const payload: BudgetInput = {
        name: values.name,
        type: values.type,
        scope: values.scope,
        period: values.period,
        amount: values.amount,
        thresholds: { warning: values.warningThreshold, critical: values.criticalThreshold },
      };
      await createBudget(payload);
      message.success('预算创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '创建失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingBudget) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateBudget(editingBudget.id, {
        name: values.name,
        amount: values.amount,
        thresholds: { warning: values.warningThreshold, critical: values.criticalThreshold },
      });
      message.success('预算更新成功');
      setEditModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : '更新失败';
        message.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreBudget(id);
      message.success('预算已重置');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`预算重置失败：${error.message}`);
      } else {
        message.error('重置失败');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      message.success('预算已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`预算删除失败：${error.message}`);
      } else {
        message.error('删除失败');
      }
    }
  };

  const columns: TableColumn<Budget>[] = [
    {
      key: 'name',
      title: '预算名称',
      dataIndex: 'name',
      width: 180,
      render: (v: unknown) => <Text strong>{String(v)}</Text>,
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
    },
    {
      key: 'scope',
      title: '范围',
      dataIndex: 'scope',
      width: 140,
      render: (v: unknown) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(v)}
        </Text>
      ),
    },
    {
      key: 'period',
      title: '周期',
      dataIndex: 'period',
      width: 80,
      render: (v: unknown) => <Tag>{String(v)}</Tag>,
    },
    {
      key: 'amount',
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      sortable: true,
      render: (v: unknown) => <Text strong>${Number(v).toFixed(2)}</Text>,
    },
    {
      key: 'thresholds',
      title: '告警阈值',
      dataIndex: 'thresholds',
      width: 140,
      render: (v: unknown) => {
        const t = v as { warning: number; critical: number };
        return t ? (
          <Space>
            <Tag color="orange">警告 {t.warning}%</Tag>
            <Tag color="red">严重 {t.critical}%</Tag>
          </Space>
        ) : null;
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => <StatusBadge status={String(v) as StatusType} size="small" />,
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingBudget(record);
              editForm.setFieldsValue({
                name: record.name,
                amount: record.amount,
                warningThreshold: record.thresholds.warning,
                criticalThreshold: record.thresholds.critical,
              });
              setEditModalVisible(true);
            }}
          >
            编辑
          </Button>
          {record.status === 'exceeded' && (
            <Button
              type="link"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => handleRestore(record.id)}
            >
              重置
            </Button>
          )}
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filterDefs: FilterDefinition[] = [
    { key: 'type', label: '类型', options: [{ label: '全部', value: 'all' }, ...typeOptions] },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Exceeded', value: 'exceeded' },
        { label: 'Restored', value: 'restored' },
      ],
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <DollarOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            预算管理
          </Title>
          <Text type="secondary">创建和管理 AI 调用预算</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建预算
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="总预算" value={budgets.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃"
              value={budgets.filter((b) => b.status === 'active').length}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已超支"
              value={budgets.filter((b) => b.status === 'exceeded').length}
              valueStyle={{ color: colors.error[400] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总预算金额"
              value={budgets.reduce((sum, b) => sum + b.amount, 0)}
              prefix="$"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: spacing.md }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索预算..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredBudgets}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建预算"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="预算名称" rules={[{ required: true }]}>
            <Input placeholder="GPT-4 月度预算" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={typeOptions} />
          </Form.Item>
          <Form.Item name="scope" label="范围" rules={[{ required: true }]}>
            <Input placeholder="tenant-id / project-id / user-id" />
          </Form.Item>
          <Form.Item name="period" label="周期" rules={[{ required: true }]}>
            <Select options={periodOptions} />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber prefix="$" style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="warningThreshold" label="警告阈值 (%)" initialValue={80}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="criticalThreshold" label="严重阈值 (%)" initialValue={95}>
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑预算"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEdit}
        confirmLoading={submitting}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="预算名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <InputNumber prefix="$" style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="warningThreshold" label="警告阈值 (%)">
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item name="criticalThreshold" label="严重阈值 (%)">
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BudgetManagement;
