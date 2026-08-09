/**
 * Firewall Policy Management (P4-05)
 * Manage inbound/outbound firewall rules with direction, protocol, port, action, and priority.
 *
 * Features:
 * - 4 summary stat cards (total / active / inbound / outbound)
 * - Rule table with direction/protocol/action tags and status switch
 * - Create/edit modal with full form (name, direction, source, port, protocol, action, priority)
 * - Delete with Popconfirm confirmation
 * - Mock data with 10 rules covering various combinations
 */
import React, { useState, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  message,
  Popconfirm,
  Switch,
  Input,
  Select,
  InputNumber,
  Form,
  Card,
  Statistic,
  Radio,
} from 'antd';
import {
  SecurityScanOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

// ---- Types ----
interface FirewallRule {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound';
  sourceIp: string;
  destPort: string;
  protocol: 'TCP' | 'UDP' | 'ICMP';
  action: 'allow' | 'deny' | 'log';
  priority: number;
  enabled: boolean;
}

// ---- Mock Data ----
const MOCK_RULES: FirewallRule[] = [
  {
    id: 'fw-001',
    name: '允许 HTTP 入站',
    direction: 'inbound',
    sourceIp: '0.0.0.0/0',
    destPort: '80',
    protocol: 'TCP',
    action: 'allow',
    priority: 10,
    enabled: true,
  },
  {
    id: 'fw-002',
    name: '允许 HTTPS 入站',
    direction: 'inbound',
    sourceIp: '0.0.0.0/0',
    destPort: '443',
    protocol: 'TCP',
    action: 'allow',
    priority: 10,
    enabled: true,
  },
  {
    id: 'fw-003',
    name: '允许 SSH 管理网段',
    direction: 'inbound',
    sourceIp: '10.0.0.0/8',
    destPort: '22',
    protocol: 'TCP',
    action: 'allow',
    priority: 5,
    enabled: true,
  },
  {
    id: 'fw-004',
    name: '拒绝外部 Telnet',
    direction: 'inbound',
    sourceIp: '0.0.0.0/0',
    destPort: '23',
    protocol: 'TCP',
    action: 'deny',
    priority: 1,
    enabled: true,
  },
  {
    id: 'fw-005',
    name: '允许 DNS 出站',
    direction: 'outbound',
    sourceIp: '10.0.0.0/8',
    destPort: '53',
    protocol: 'UDP',
    action: 'allow',
    priority: 10,
    enabled: true,
  },
  {
    id: 'fw-006',
    name: '拒绝外网数据库访问',
    direction: 'outbound',
    sourceIp: '172.16.0.0/12',
    destPort: '3306',
    protocol: 'TCP',
    action: 'deny',
    priority: 2,
    enabled: true,
  },
  {
    id: 'fw-007',
    name: '允许容器间通信',
    direction: 'inbound',
    sourceIp: '192.168.0.0/16',
    destPort: '8080-8090',
    protocol: 'TCP',
    action: 'allow',
    priority: 15,
    enabled: false,
  },
  {
    id: 'fw-008',
    name: '日志记录 NTP 流量',
    direction: 'outbound',
    sourceIp: '10.10.0.0/16',
    destPort: '123',
    protocol: 'UDP',
    action: 'log',
    priority: 50,
    enabled: true,
  },
  {
    id: 'fw-009',
    name: '拒绝 ICMP 外部探测',
    direction: 'inbound',
    sourceIp: '203.0.113.0/24',
    destPort: '0',
    protocol: 'ICMP',
    action: 'deny',
    priority: 3,
    enabled: true,
  },
  {
    id: 'fw-010',
    name: '允许内部 ICMP 探测',
    direction: 'inbound',
    sourceIp: '10.0.0.0/8',
    destPort: '0',
    protocol: 'ICMP',
    action: 'allow',
    priority: 20,
    enabled: false,
  },
];

// ---- Tag Color Configs ----
const directionTagColor: Record<string, string> = {
  inbound: colors.info[500],
  outbound: colors.warning[500],
};

const protocolTagColor: Record<string, string> = {
  TCP: colors.purple[500],
  UDP: colors.info[500],
  ICMP: colors.neutral[500],
};

const actionTagColor: Record<string, string> = {
  allow: colors.success[500],
  deny: colors.error[500],
  log: colors.info[500],
};

const FirewallPolicy: React.FC = () => {
  const [rules, setRules] = useState<FirewallRule[]>(MOCK_RULES);
  const [openModal, setOpenModal] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const [form] = Form.useForm();

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.enabled).length;
    const inbound = rules.filter((r) => r.direction === 'inbound').length;
    const outbound = rules.filter((r) => r.direction === 'outbound').length;
    return { total, active, inbound, outbound };
  }, [rules]);

  // ---- Handlers ----
  const handleToggle = (id: string, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r))
    );
    message.success(enabled ? '规则已启用' : '规则已禁用');
  };

  const handleDelete = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    message.success('规则已删除');
  };

  const handleEdit = (rule: FirewallRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      direction: rule.direction,
      sourceIp: rule.sourceIp,
      destPort: rule.destPort,
      protocol: rule.protocol,
      action: rule.action,
      priority: rule.priority,
    });
    setOpenModal(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ priority: 50 });
    setOpenModal(true);
  };

  const handleModalCancel = () => {
    setOpenModal(false);
    setEditingRule(null);
    form.resetFields();
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const { name, direction, sourceIp, destPort, protocol, action, priority } = values;

      if (editingRule) {
        setRules((prev) =>
          prev.map((r) =>
            r.id === editingRule.id
              ? { ...r, name, direction, sourceIp, destPort, protocol, action, priority }
              : r
          )
        );
        message.success('规则已更新');
      } else {
        const newRule: FirewallRule = {
          id: `fw-${Date.now().toString(36)}`,
          name,
          direction,
          sourceIp,
          destPort,
          protocol,
          action,
          priority,
          enabled: true,
        };
        setRules((prev) => [...prev, newRule]);
        message.success('规则已创建');
      }
      setOpenModal(false);
      setEditingRule(null);
      form.resetFields();
    } catch {
      // Validation failed
    }
  };

  // ---- Stat card config ----
  const statCards = [
    {
      title: '总策略数',
      value: stats.total,
      color: colors.primary[500],
      bgColor: colors.primary[50],
    },
    {
      title: '活跃规则',
      value: stats.active,
      color: colors.success[500],
      bgColor: colors.success[50],
    },
    {
      title: '入站规则',
      value: stats.inbound,
      color: colors.info[500],
      bgColor: colors.info[50],
    },
    {
      title: '出站规则',
      value: stats.outbound,
      color: colors.warning[500],
      bgColor: colors.warning[50],
    },
  ];

  // ---- Table columns ----
  const columns: TableColumn<FirewallRule>[] = [
    {
      key: 'name',
      title: '规则名称',
      dataIndex: 'name',
      render: (value) => <strong>{String(value)}</strong>,
    },
    {
      key: 'direction',
      title: '方向',
      dataIndex: 'direction',
      render: (value) => {
        const v = String(value);
        const label = v === 'inbound' ? '入站' : '出站';
        return <Tag color={directionTagColor[v]}>{label}</Tag>;
      },
    },
    {
      key: 'sourceIp',
      title: '源 IP/网段',
      dataIndex: 'sourceIp',
      render: (value) => <code>{String(value)}</code>,
    },
    {
      key: 'destPort',
      title: '目标端口',
      dataIndex: 'destPort',
      render: (value) => <code>{String(value)}</code>,
    },
    {
      key: 'protocol',
      title: '协议',
      dataIndex: 'protocol',
      render: (value) => {
        const v = String(value);
        return <Tag color={protocolTagColor[v]}>{v}</Tag>;
      },
    },
    {
      key: 'action',
      title: '动作',
      dataIndex: 'action',
      render: (value) => {
        const v = String(value);
        const label = v === 'allow' ? '允许' : v === 'deny' ? '拒绝' : '日志';
        return <Tag color={actionTagColor[v]}>{label}</Tag>;
      },
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      render: (value) => Number(value),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      render: (value, record) => (
        <Switch
          checked={value as boolean}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          size="small"
          onChange={(checked) => handleToggle(record.id, checked)}
        />
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_: unknown, record) => (
        <Space size={spacing.sm}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此规则？"
            description={`将删除规则 "${record.name}"`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SecurityScanOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        防火墙策略管理
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.lg, display: 'block' }}>
        入站/出站规则 · 端口管理 · 流量审计
      </Text>

      {/* Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        {statCards.map((card) => (
          <Card
            key={card.title}
            style={{
              backgroundColor: card.bgColor,
              borderLeft: `3px solid ${card.color}`,
              borderRadius: 12,
            }}
          >
            <Statistic
              title={card.title}
              value={card.value}
              valueStyle={{ color: card.color, fontSize: 28 }}
            />
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ fontWeight: 600, fontSize: 16 }}>规则列表</Text>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建规则
          </Button>
        </div>
        <Table<FirewallRule>
          columns={columns}
          dataSource={rules}
          rowKey="id"
          size="middle"
          pagination={{ current: 1, pageSize: 10, total: rules.length }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑防火墙规则' : '新建防火墙规则'}
        open={openModal}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText={editingRule ? '更新' : '创建'}
        cancelText="取消"
        width={600}
        style={{ borderRadius: 16 }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ priority: 50 }}
          style={{ maxWidth: 560 }}
        >
          <Form.Item
            label="规则名称"
            name="name"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="例：允许 HTTPS 入站" />
          </Form.Item>

          <Form.Item
            label="方向"
            name="direction"
            rules={[{ required: true, message: '请选择方向' }]}
          >
            <Radio.Group>
              <Radio value="inbound">入站</Radio>
              <Radio value="outbound">出站</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="源 IP/网段"
            name="sourceIp"
            rules={[{ required: true, message: '请输入源 IP/网段' }]}
          >
            <Input placeholder="例：0.0.0.0/0 或 10.0.0.0/8" />
          </Form.Item>

          <Form.Item
            label="目标端口"
            name="destPort"
            rules={[{ required: true, message: '请输入目标端口' }]}
          >
            <Input placeholder="例：80,443 或 8080-8090" />
          </Form.Item>

          <Form.Item
            label="协议"
            name="protocol"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select placeholder="请选择协议">
              <Select.Option value="TCP">TCP</Select.Option>
              <Select.Option value="UDP">UDP</Select.Option>
              <Select.Option value="ICMP">ICMP</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="动作"
            name="action"
            rules={[{ required: true, message: '请选择动作' }]}
          >
            <Select placeholder="请选择动作">
              <Select.Option value="allow">允许</Select.Option>
              <Select.Option value="deny">拒绝</Select.Option>
              <Select.Option value="log">日志</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[
              { required: true, message: '请输入优先级' },
              { type: 'number', min: 1, max: 100, message: '优先级范围：1-100' },
            ]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="1-100" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FirewallPolicy;
