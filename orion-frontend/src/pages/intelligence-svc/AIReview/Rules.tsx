/**
 * AI Review - Rules
 * Review rule management with CRUD operations
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Select,
  Modal,
  Form,
  message,
  Popconfirm,
  Switch,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import {
  getReviewRules,
  createReviewRule,
  updateReviewRule,
  deleteReviewRule,
  toggleReviewRule,
} from '@/api/ai-review';
import type { AIReviewRule } from '@/api/ai-review';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AIReviewRules: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AIReviewRule[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AIReviewRule | null>(null);
  const [form] = Form.useForm();
  const [formLoading, setFormLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getReviewRules();
      setData(res.data?.items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载评审规则失败：${error.message}`);
      } else {
        message.error('加载评审规则失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (ruleId: string) => {
    try {
      await toggleReviewRule(ruleId);
      message.success('规则状态已切换');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`切换规则状态失败：${error.message}`);
      } else {
        message.error('切换规则状态失败，请稍后重试');
      }
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteReviewRule(ruleId);
      message.success('规则已删除');
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除规则失败：${error.message}`);
      } else {
        message.error('删除规则失败，请稍后重试');
      }
    }
  };

  const openCreateModal = () => {
    setEditingRule(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (rule: AIReviewRule) => {
    setEditingRule(rule);
    form.setFieldsValue(rule);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    setFormLoading(true);
    try {
      if (editingRule) {
        await updateReviewRule(editingRule.id, values);
        message.success('规则已更新');
      } else {
        await createReviewRule(values);
        message.success('规则已创建');
      }
      setModalOpen(false);
      loadData();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(
          editingRule ? `更新规则失败：${error.message}` : `创建规则失败：${error.message}`
        );
      } else {
        message.error(editingRule ? '更新规则失败，请稍后重试' : '创建规则失败，请稍后重试');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'orange';
      case 'info':
        return 'blue';
      default:
        return 'default';
    }
  };

  const filteredData = data.filter((rule) => {
    const matchSearch =
      !searchText ||
      rule.name.toLowerCase().includes(searchText.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchText.toLowerCase());
    const matchCategory = !categoryFilter || rule.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const categories = [...new Set(data.map((r) => r.category))];

  const columns = [
    { title: '规则 ID', dataIndex: 'id', key: 'id', width: 120, ellipsis: true },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => <Tag color={severityColor(severity)}>{severity}</Tag>,
    },
    { title: '模式', dataIndex: 'pattern', key: 'pattern', ellipsis: true },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: AIReviewRule) => (
        <Switch checked={enabled} onChange={() => handleToggle(record.id)} size="small" />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: AIReviewRule) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此规则？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tableData = filteredData.map((r) => ({ ...r, key: r.id }));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ScanOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            评审规则
          </Title>
          <Text type="secondary">管理 AI 代码评审规则</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          添加规则
        </Button>
      </div>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索规则名称或描述"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            placeholder="分类"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            style={{ width: 150 }}
          >
            {categories.map((c) => (
              <Select.Option key={c} value={c}>
                {c}
              </Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          size="small"
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑规则' : '添加规则'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例如：no-console-log" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              <Select.Option value="best-practice">最佳实践</Select.Option>
              <Select.Option value="security">安全</Select.Option>
              <Select.Option value="performance">性能</Select.Option>
              <Select.Option value="style">代码风格</Select.Option>
              <Select.Option value="bug-prevention">Bug 预防</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="severity"
            label="严重程度"
            rules={[{ required: true, message: '请选择严重程度' }]}
          >
            <Select>
              <Select.Option value="critical">Critical</Select.Option>
              <Select.Option value="warning">Warning</Select.Option>
              <Select.Option value="info">Info</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="pattern"
            label="模式"
            rules={[{ required: true, message: '请输入匹配模式' }]}
          >
            <Input placeholder="例如：console\\.log" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={3} placeholder="规则描述..." />
          </Form.Item>
          <Form.Item name="suggestion" label="修复建议">
            <TextArea rows={2} placeholder="可选的修复建议..." />
          </Form.Item>
          <Form.Item name="fileExtensions" label="文件扩展名">
            <Select mode="tags" placeholder="例如：.ts, .tsx, .js" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={formLoading} block>
              {editingRule ? '更新' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AIReviewRules;
