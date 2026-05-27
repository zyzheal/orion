/**
 * ChatOps Admin Settings - 管理后台
 *
 * 功能:
 * - 命令-Capability 映射管理 (CRUD, 按环境过滤, 搜索, 分页)
 * - 审批配置管理 (配置各命令的审批要求, 审批人管理)
 *
 * 设计要求:
 * - 使用 Design Token 系统
 * - Apple/飞书风格
 * - Ant Design 组件
 * - 编辑使用 Modal 弹窗
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Typography,
  message,
  Popconfirm,
  Empty,
  Tooltip,
} from 'antd';
import {
  SafetyOutlined,
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  chatopsAdminApi,
  type CapabilityMapping,
  type CreateCapabilityMappingInput,
  type UpdateCapabilityMappingInput,
  type ApprovalConfig,
  type Approver,
} from '@/api/chatops-admin';
import { getAuditLogs, type AuditLog, type AuditLogListParams } from '@/api/chatops';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import PermissionAdmin from './PermissionAdmin';
import CommandVersionPage from './CommandVersionPage';
import RateLimitPage from './RateLimitPage';
import WebhookPage from './WebhookPage';

const { Text } = Typography;
const { Option } = Select;

// ==================== 颜色映射 ====================

const riskLevelConfig: Record<number, { label: string; color: string }> = {
  1: { label: '低', color: colors.success[500] },
  2: { label: '中', color: colors.warning[500] },
  3: { label: '高', color: colors.error[400] },
  4: { label: '严重', color: colors.purple[600] },
};

const environmentOptions = [
  { label: '全部', value: '' },
  { label: '开发 (dev)', value: 'dev' },
  { label: '测试 (staging)', value: 'staging' },
  { label: '生产 (prod)', value: 'prod' },
];

// ==================== Capability Mapping Tab ====================

const CapabilityMappingTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [mappings, setMappings] = useState<CapabilityMapping[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [environment, setEnvironment] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMapping, setEditingMapping] = useState<CapabilityMapping | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatopsAdminApi.getCapabilityMappings(
        environment || undefined
      );
      const data = res.data ?? [];
      setMappings(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取映射列表失败');
      setMappings([]);
    } finally {
      setLoading(false);
    }
  }, [environment]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredMappings = mappings.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.command_id.toLowerCase().includes(q) ||
      m.capability_id.toLowerCase().includes(q)
    );
  });

  const handleCreate = () => {
    setEditingMapping(null);
    form.resetFields();
    form.setFieldsValue({ risk_level: 1, requires_approval: false });
    setModalVisible(true);
  };

  const handleEdit = (record: CapabilityMapping) => {
    setEditingMapping(record);
    form.setFieldsValue({
      command_id: record.command_id,
      capability_id: record.capability_id,
      environment: record.environment,
      risk_level: record.risk_level,
      requires_approval: record.requires_approval,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await chatopsAdminApi.deleteCapabilityMapping(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingMapping) {
        await chatopsAdminApi.updateCapabilityMapping(
          editingMapping.id,
          values as UpdateCapabilityMappingInput
        );
        message.success('更新成功');
      } else {
        await chatopsAdminApi.createCapabilityMapping(
          values as CreateCapabilityMappingInput
        );
        message.success('创建成功');
      }
      setModalVisible(false);
      loadData();
    } catch {
      // 表单校验失败或 API 错误
    }
  };

  const columns = [
    {
      title: '命令',
      dataIndex: 'command_id',
      key: 'command_id',
      width: 180,
      render: (v: string) => <Text code>/{v}</Text>,
    },
    {
      title: 'Capability',
      dataIndex: 'capability_id',
      key: 'capability_id',
      width: 200,
      render: (v: string) => (
        <Text strong style={{ color: colors.purple[500] }}>
          {v}
        </Text>
      ),
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      width: 120,
      render: (v: string) =>
        v ? (
          <Tag color={colors.info[500]}>{v}</Tag>
        ) : (
          <Tag>全部</Tag>
        ),
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (v: number) => {
        const cfg = riskLevelConfig[v] || { label: String(v), color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '需审批',
      dataIndex: 'requires_approval',
      key: 'requires_approval',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? colors.warning[500] : colors.neutral[300]}>
          {v ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {v ? dayjs(v).fromNow() : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: CapabilityMapping) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.light.border.light}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索命令或 Capability"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={environment}
              onChange={setEnvironment}
              style={{ width: 160 }}
              options={environmentOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              style={{
                background: colors.primary[500],
                borderColor: colors.primary[500],
              }}
            >
              新建映射
            </Button>
          </Space>
        </div>
        {filteredMappings.length === 0 && !loading ? (
          <Empty
            description={
              searchQuery ? '未找到匹配的映射' : '暂无映射配置'
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {!searchQuery && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                style={{
                  background: colors.primary[500],
                  borderColor: colors.primary[500],
                }}
              >
                新建映射
              </Button>
            )}
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredMappings}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        )}
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingMapping ? '编辑映射' : '新建映射'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={520}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="command_id"
            label="命令名称"
            rules={[{ required: true, message: '请输入命令名称' }]}
          >
            <Input prefix="/" placeholder="例如: deploy, pipeline, restart" />
          </Form.Item>
          <Form.Item
            name="capability_id"
            label="Capability ID"
            rules={[{ required: true, message: '请输入 Capability ID' }]}
          >
            <Input placeholder="例如: deploy:production, pipeline:run" />
          </Form.Item>
          <Form.Item name="environment" label="环境">
            <Select
              placeholder="全部环境"
              allowClear
              options={[
                { label: '全部', value: '' },
                { label: '开发 (dev)', value: 'dev' },
                { label: '测试 (staging)', value: 'staging' },
                { label: '生产 (prod)', value: 'prod' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="risk_level"
            label="风险等级"
            rules={[{ required: true, message: '请选择风险等级' }]}
          >
            <Select>
              <Option value={1}>
                <Tag color={colors.success[500]}>低</Tag> 安全操作，无需审批
              </Option>
              <Option value={2}>
                <Tag color={colors.warning[500]}>中</Tag> 需要关注
              </Option>
              <Option value={3}>
                <Tag color={colors.error[400]}>高</Tag> 高风险操作
              </Option>
              <Option value={4}>
                <Tag color={colors.purple[600]}>严重</Tag> 需要多级审批
              </Option>
            </Select>
          </Form.Item>
          <Form.Item name="requires_approval" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ==================== Approval Config Tab ====================

const ApprovalConfigTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<ApprovalConfig[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [editingConfig, setEditingConfig] = useState<ApprovalConfig | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, approverRes] = await Promise.all([
        chatopsAdminApi.getApprovalConfigs(),
        chatopsAdminApi.getApprovers(),
      ]);
      setConfigs(configRes.data ?? []);
      setApprovers(approverRes.data ?? []);
    } catch {
      message.error('获取审批配置失败');
      setConfigs([]);
      setApprovers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (record: ApprovalConfig) => {
    setEditingConfig(record);
    form.setFieldsValue({
      enabled: record.enabled,
      approvers: record.approvers,
      threshold: record.threshold,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!editingConfig) return;
      await chatopsAdminApi.updateApprovalConfig(
        editingConfig.capability,
        values
      );
      message.success('更新成功');
      setModalVisible(false);
      loadData();
    } catch {
      // 表单校验失败或 API 错误
    }
  };

  const columns = [
    {
      title: '能力域',
      dataIndex: 'capability',
      key: 'capability',
      width: 200,
      render: (v: string) => (
        <Text strong style={{ color: colors.purple[500] }}>
          {v}
        </Text>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (v: boolean) => (
        <Tag color={v ? colors.success[500] : colors.neutral[300]}>
          {v ? '已启用' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '审批阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
      render: (v: number) => <Text>{v} 人</Text>,
    },
    {
      title: '审批人',
      dataIndex: 'approvers',
      key: 'approvers',
      render: (v: string[]) => (
        <Space wrap>
          {v.map((a) => (
            <Tag key={a} icon={<TeamOutlined />}>
              {a}
            </Tag>
          ))}
          {v.length === 0 && <Text type="secondary">未配置</Text>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ApprovalConfig) => (
        <Tooltip title="编辑">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
        </Tooltip>
      ),
    },
  ];

  const approverColumns = [
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 150,
      render: (v: string) => <Text code>{v}</Text>,
    },
    {
      title: '姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (v: string) => (v ? <Text type="secondary">{v}</Text> : '-'),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (v: string) => (v ? <Tag>{v}</Tag> : '-'),
    },
    {
      title: '值班中',
      dataIndex: 'is_on_duty',
      key: 'is_on_duty',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? colors.success[500] : colors.neutral[300]}>
          {v ? '是' : '否'}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      {/* 审批配置 */}
      <Card
        bodyStyle={{ padding: '0 24px 24px' }}
        style={{ marginBottom: 16 }}
      >
        <div style={{ paddingTop: 20, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.light.border.light}` }}>
          <Space>
            <SafetyOutlined style={{ color: colors.purple[500], fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.light.text.primary }}>
              审批配置
            </span>
          </Space>
        </div>
        {configs.length === 0 && !loading ? (
          <Empty
            description="暂无审批配置"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={configs}
            rowKey="capability"
            loading={loading}
            size="middle"
            pagination={false}
          />
        )}
      </Card>

      {/* 审批人列表 */}
      <Card
        bodyStyle={{ padding: '0 24px 24px' }}
      >
        <div style={{ paddingTop: 20, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.light.border.light}` }}>
          <Space>
            <TeamOutlined style={{ color: colors.primary[500], fontSize: 18 }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.light.text.primary }}>
              审批人列表
            </span>
          </Space>
        </div>
        {approvers.length === 0 && !loading ? (
          <Empty
            description="暂无审批人"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={approverColumns}
            dataSource={approvers}
            rowKey="user_id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 人` }}
          />
        )}
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑审批配置"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={520}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item name="enabled" label="启用审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="approvers" label="审批人">
            <Select mode="multiple" placeholder="选择审批人">
              {approvers.map((a) => (
                <Option key={a.user_id} value={a.user_id}>
                  {a.user_name} ({a.user_id})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="threshold" label="审批阈值">
            <InputNumber
              min={1}
              max={10}
              style={{ width: '100%' }}
              addonAfter="人同意即可"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ==================== Audit Log Tab ====================

const AuditLogTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filters, setFilters] = useState<AuditLogListParams>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: AuditLogListParams = {
        page: 1,
        perPage: 50,
        ...filters,
      };
      const res = await getAuditLogs(params);
      const data = res.data ?? [];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      message.error('获取审计日志失败');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = [
    {
      title: '操作者',
      key: 'actor',
      width: 140,
      render: (_: unknown, record: AuditLog) => {
        const actor =
          typeof record.actor === 'string'
            ? record.actor
            : record.actor?.userId || '-';
        return <Text code>{actor}</Text>;
      },
    },
    {
      title: '命令',
      key: 'command',
      width: 140,
      render: (_: unknown, record: AuditLog) => {
        const action =
          typeof record.action === 'string'
            ? record.action
            : record.action?.command || '-';
        return <Text code>/{action}</Text>;
      },
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      render: (v: string) => (
        <Tag color={v === 'success' ? colors.success[500] : colors.error[400]}>
          {v || '-'}
        </Tag>
      ),
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Text>
      ),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {v || '-'}
          </Text>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      {/* 标题 + 工具栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Space>
          <AuditOutlined style={{ color: colors.info[500], fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: colors.light.text.primary }}>
            审计日志
          </span>
        </Space>
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索命令"
            value={filters.command}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, command: e.target.value }))
            }
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="用户 ID"
            value={filters.userId}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, userId: e.target.value }))
            }
            style={{ width: 160 }}
            allowClear
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Card bodyStyle={{ padding: '0 24px 24px' }}>
        {logs.length === 0 && !loading ? (
          <Empty
            description="暂无审计日志"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        )}
      </Card>
    </div>
  );
};

// ==================== Main Admin Settings Page ====================

const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('mappings');

  const tabItems = [
    {
      key: 'mappings',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SafetyOutlined />
          命令-Capability 映射
        </span>
      ),
      children: <CapabilityMappingTab />,
    },
    {
      key: 'approval',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ClockCircleOutlined />
          审批配置
        </span>
      ),
      children: <ApprovalConfigTab />,
    },
    {
      key: 'audit',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AuditOutlined />
          审计日志
        </span>
      ),
      children: <AuditLogTab />,
    },
    {
      key: 'permissions',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SafetyOutlined />
          权限管理
        </span>
      ),
      children: <PermissionAdmin />,
    },
    {
      key: 'versions',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <HistoryOutlined />
          版本管理
        </span>
      ),
      children: <CommandVersionPage />,
    },
    {
      key: 'rate-limits',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ThunderboltOutlined />
          速率限制
        </span>
      ),
      children: <RateLimitPage />,
    },
    {
      key: 'webhooks',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <LinkOutlined />
          Webhook 管理
        </span>
      ),
      children: <WebhookPage />,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      {/* 功能标签页 */}
      <Card bodyStyle={{ padding: '16px 24px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          defaultActiveKey="mappings"
          items={tabItems}
        />
      </Card>
    </div>
  );
};

export default AdminSettings;
