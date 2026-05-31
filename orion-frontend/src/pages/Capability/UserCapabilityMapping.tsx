/**
 * 用户能力覆盖页面
 * 为用户临时授权/撤销能力，查看用户有效能力
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Input,
  Card,
  Row,
  Col,
  Typography,
  Modal,
  Form,
  Select,
  DatePicker,
  message,
  Badge,
  Tooltip,
  Avatar,
  Collapse,
  Empty,
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Text } = Typography;
const {} = Collapse;

// ==================== 类型定义 ====================

/**
 * 能力数据模型
 */
interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 1 | 2 | 3 | 4;
  requiresApproval: boolean;
}

/**
 * 用户数据模型
 */
interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  roles: string[];
  roleNames: string[];
  effectiveCount: number;
}

/**
 * 用户能力覆盖
 */
interface UserCapabilityOverride {
  id: string;
  userId: string;
  capabilityId: string;
  capabilityName: string;
  capabilityCategory: string;
  granted: boolean;
  reason?: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
}

// ==================== Mock 数据 ====================

const mockUsers: User[] = [
  {
    id: 'user-1',
    username: 'zhangsan',
    name: '张三',
    email: 'zhangsan@orion.design',
    roles: ['developer', 'viewer'],
    roleNames: ['Developer', 'Viewer'],
    effectiveCount: 28,
  },
  {
    id: 'user-2',
    username: 'lisi',
    name: '李四',
    email: 'lisi@orion.design',
    roles: ['sre'],
    roleNames: ['SRE'],
    effectiveCount: 35,
  },
  {
    id: 'user-3',
    username: 'wangwu',
    name: '王五',
    email: 'wangwu@orion.design',
    roles: ['developer'],
    roleNames: ['Developer'],
    effectiveCount: 18,
  },
  {
    id: 'user-4',
    username: 'zhaoliu',
    name: '赵六',
    email: 'zhaoliu@orion.design',
    roles: ['viewer'],
    roleNames: ['Viewer'],
    effectiveCount: 8,
  },
];

const mockCapabilities: Capability[] = [
  {
    id: 'chatops_view',
    name: 'ChatOps 查看',
    description: '查看命令目录',
    category: 'ChatOps',
    riskLevel: 1,
    requiresApproval: false,
  },
  {
    id: 'chatops_card_manage',
    name: '问答卡片管理',
    description: '管理问答卡片',
    category: 'ChatOps',
    riskLevel: 2,
    requiresApproval: false,
  },
  {
    id: 'chatops_command_manage',
    name: '命令配置管理',
    description: '管理命令',
    category: 'ChatOps',
    riskLevel: 3,
    requiresApproval: true,
  },
  {
    id: 'chatops_platform_manage',
    name: '平台配置管理',
    description: '管理平台配置',
    category: 'ChatOps',
    riskLevel: 4,
    requiresApproval: true,
  },
  {
    id: 'pipeline_view',
    name: '流水线查看',
    description: '查看流水线',
    category: 'Pipeline',
    riskLevel: 1,
    requiresApproval: false,
  },
  {
    id: 'pipeline_create',
    name: '流水线创建',
    description: '创建流水线',
    category: 'Pipeline',
    riskLevel: 2,
    requiresApproval: false,
  },
  {
    id: 'pipeline_trigger_prod',
    name: '生产环境流水线触发',
    description: '触发生产流水线',
    category: 'Pipeline',
    riskLevel: 4,
    requiresApproval: true,
  },
  {
    id: 'deployment_operations',
    name: '部署操作',
    description: '执行部署',
    category: 'Deployment',
    riskLevel: 3,
    requiresApproval: true,
  },
  {
    id: 'deployment_rollback',
    name: '部署回滚',
    description: '执行回滚',
    category: 'Deployment',
    riskLevel: 4,
    requiresApproval: true,
  },
  {
    id: 'secret_operations',
    name: '密钥操作',
    description: '管理密钥',
    category: 'Security',
    riskLevel: 4,
    requiresApproval: true,
  },
  {
    id: 'backup_operations',
    name: '备份操作',
    description: '执行备份',
    category: 'Security',
    riskLevel: 3,
    requiresApproval: true,
  },
  {
    id: 'disaster_recovery',
    name: '灾备操作',
    description: '执行灾备',
    category: 'Security',
    riskLevel: 4,
    requiresApproval: true,
  },
];

const initialOverrides: UserCapabilityOverride[] = [
  {
    id: 'override-1',
    userId: 'user-1',
    capabilityId: 'deployment_operations',
    capabilityName: '部署操作',
    capabilityCategory: 'Deployment',
    granted: true,
    reason: '项目紧急上线需要',
    grantedBy: 'heal',
    grantedAt: '2026-05-15',
    expiresAt: '2026-05-25',
  },
  {
    id: 'override-2',
    userId: 'user-1',
    capabilityId: 'pipeline_trigger_prod',
    capabilityName: '生产环境流水线触发',
    capabilityCategory: 'Pipeline',
    granted: true,
    reason: '紧急修复需要',
    grantedBy: 'heal',
    grantedAt: '2026-05-16',
    expiresAt: null,
  },
  {
    id: 'override-3',
    userId: 'user-2',
    capabilityId: 'secret_operations',
    capabilityName: '密钥操作',
    capabilityCategory: 'Security',
    granted: true,
    reason: '密钥轮换操作',
    grantedBy: 'heal',
    grantedAt: '2026-05-10',
    expiresAt: '2026-06-10',
  },
  {
    id: 'override-4',
    userId: 'user-3',
    capabilityId: 'chatops_command_manage',
    capabilityName: '命令配置管理',
    capabilityCategory: 'ChatOps',
    granted: false,
    reason: '权限调整',
    grantedBy: 'heal',
    grantedAt: '2026-05-12',
    expiresAt: null,
  },
];

// ==================== 工具函数 ====================

const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    ChatOps: 'blue',
    Pipeline: 'cyan',
    Deployment: 'purple',
    Environment: 'green',
    Security: 'red',
  };
  return colorMap[category] || 'default';
};

const getRiskLevelColor = (level: number): string => {
  const colorMap: Record<number, string> = {
    1: 'green',
    2: 'orange',
    3: 'red',
    4: 'magenta',
  };
  return colorMap[level] || 'default';
};

// ==================== 组件 ====================

/**
 * 用户能力覆盖页面
 */
const UserCapabilityMapping: React.FC = () => {
  // 状态
  const [users] = useState<User[]>(mockUsers);
  const [overrides, setOverrides] = useState<UserCapabilityOverride[]>(initialOverrides);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 筛选用户
  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    const search = searchText.toLowerCase();
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(search) ||
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
    );
  }, [users, searchText]);

  // 获取用户的覆盖
  const getUserOverrides = useCallback(
    (userId: string) => {
      return overrides.filter((o) => o.userId === userId);
    },
    [overrides]
  );

  // 删除覆盖
  const handleDeleteOverride = useCallback((overrideId: string) => {
    setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    message.success('覆盖已撤销');
  }, []);

  // 打开添加覆盖弹窗
  const handleOpenModal = useCallback(
    (user: User) => {
      setSelectedUser(user);
      form.resetFields();
      setModalOpen(true);
    },
    [form]
  );

  // 提交添加覆盖
  const handleSubmitOverride = useCallback(
    (values: {
      capabilityId: string;
      granted: boolean;
      expiresAt: dayjs.Dayjs | null;
      reason: string;
    }) => {
      if (!selectedUser) return;

      const capability = mockCapabilities.find((c) => c.id === values.capabilityId);
      if (!capability) return;

      const newOverride: UserCapabilityOverride = {
        id: `override-${Date.now()}`,
        userId: selectedUser.id,
        capabilityId: values.capabilityId,
        capabilityName: capability.name,
        capabilityCategory: capability.category,
        granted: values.granted,
        reason: values.reason,
        grantedBy: 'current_user',
        grantedAt: new Date().toISOString().split('T')[0],
        expiresAt: values.expiresAt ? values.expiresAt.format('YYYY-MM-DD') : null,
      };

      setOverrides((prev) => [...prev, newOverride]);
      setModalOpen(false);
      form.resetFields();
      message.success(`已${values.granted ? '授予' : '撤销'}用户能力`);
    },
    [selectedUser, form]
  );

  // 刷新
  const handleRefresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('已刷新');
    }, 500);
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: User) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ background: colors.primary[500] }} />
          <div>
            <div style={{ fontWeight: 500 }}>
              {record.name}
              <Text type="secondary" style={{ marginLeft: 8, fontSize: spacing[3] }}>
                ({record.username})
              </Text>
            </div>
            <div style={{ fontSize: spacing[3], color: colors.neutral[400] }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roleNames',
      key: 'roles',
      render: (roleNames: string[]) => (
        <Space wrap>
          {roleNames.map((role) => (
            <Tag key={role} color="blue">
              {role}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '有效能力数',
      dataIndex: 'effectiveCount',
      key: 'effectiveCount',
      render: (count: number) => (
        <Badge count={count} showZero style={{ backgroundColor: colors.primary[500] }} />
      ),
    },
    {
      title: '用户覆盖',
      key: 'overrides',
      render: (_: unknown, record: User) => {
        const userOverrides = getUserOverrides(record.id);
        const grantCount = userOverrides.filter((o) => o.granted).length;
        const revokeCount = userOverrides.filter((o) => !o.granted).length;

        return (
          <Space>
            {grantCount > 0 && <Tag color="success">授予 {grantCount}</Tag>}
            {revokeCount > 0 && <Tag color="error">撤销 {revokeCount}</Tag>}
            {userOverrides.length === 0 && <Text type="secondary">无</Text>}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            添加覆盖
          </Button>
        </Space>
      ),
    },
  ];

  // 覆盖表格列
  const overrideColumns = [
    {
      title: '能力',
      dataIndex: 'capabilityName',
      key: 'capabilityName',
      render: (name: string, record: UserCapabilityOverride) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Space>
            <Tag color={getCategoryColor(record.capabilityCategory)} style={{ fontSize: 10 }}>
              {record.capabilityCategory}
            </Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'granted',
      key: 'granted',
      width: 80,
      render: (granted: boolean) =>
        granted ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            授予
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            撤销
          </Tag>
        ),
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 120,
      render: (expiresAt: string | null) =>
        expiresAt ? (
          <Space>
            <ClockCircleOutlined />
            <Text>{expiresAt}</Text>
          </Space>
        ) : (
          <Tag>永久</Tag>
        ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => (
        <Tooltip title={reason}>
          <Text type="secondary" ellipsis style={{ maxWidth: 150 }}>
            {reason || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: UserCapabilityOverride) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteOverride(record.id)}
        >
          撤销
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 搜索和操作栏 */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Row gutter={[spacing.md, spacing.md]} align="middle">
          <Col flex="auto">
            <Input
              placeholder="搜索用户..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 300 }}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 用户列表 */}
      <Table
        columns={columns}
        dataSource={filteredUsers}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => {
            const userOverrides = getUserOverrides(record.id);
            return (
              <div style={{ padding: spacing.md }}>
                <div style={{ marginBottom: spacing.sm }}>
                  <Text strong>用户覆盖 ({userOverrides.length})</Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenModal(record)}
                    style={{ marginLeft: spacing.sm }}
                  >
                    添加
                  </Button>
                </div>
                {userOverrides.length > 0 ? (
                  <Table
                    columns={overrideColumns}
                    dataSource={userOverrides}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无用户覆盖" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            );
          },
          rowExpandable: (_record) => true,
        }}
      />

      {/* 添加覆盖弹窗 */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            添加用户能力覆盖
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitOverride}>
          <Form.Item label="用户" style={{ marginBottom: spacing.md }}>
            <Input
              value={selectedUser ? `${selectedUser.name} (${selectedUser.username})` : ''}
              disabled
            />
          </Form.Item>

          <Form.Item
            name="capabilityId"
            label="能力"
            rules={[{ required: true, message: '请选择能力' }]}
          >
            <Select placeholder="请选择能力" showSearch optionFilterProp="children">
              {mockCapabilities.map((cap) => (
                <Select.Option key={cap.id} value={cap.id}>
                  <Space>
                    <Tag color={getCategoryColor(cap.category)} style={{ fontSize: 10 }}>
                      {cap.category}
                    </Tag>
                    {cap.name}
                    <Tag color={getRiskLevelColor(cap.riskLevel)} style={{ fontSize: 10 }}>
                      L{cap.riskLevel}
                    </Tag>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="granted"
            label="操作"
            rules={[{ required: true, message: '请选择操作' }]}
            initialValue={true}
          >
            <Space>
              <Space.Compact>
                <Select.Option value={true}>
                  <Badge status="success" text="授予" />
                </Select.Option>
                <Select.Option value={false}>
                  <Badge status="error" text="撤销" />
                </Select.Option>
              </Space.Compact>
            </Space>
          </Form.Item>

          <Form.Item name="expiresAt" label="过期时间" extra="留空表示永久生效">
            <DatePicker
              style={{ width: '100%' }}
              placeholder="选择过期时间"
              format="YYYY-MM-DD"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <Form.Item name="reason" label="原因" extra="可选，用于记录授权原因">
            <Input.TextArea placeholder="请输入授权原因..." rows={2} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserCapabilityMapping;
