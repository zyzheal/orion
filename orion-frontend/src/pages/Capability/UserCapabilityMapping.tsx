/**
 * 用户能力覆盖页面
 * 为用户临时授权/撤销能力，查看用户有效能力
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { capabilityApi, type Capability as ApiCapability } from '@/api/capability';
import { userApi, type UserProfile } from '@/api/user';

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
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [overrides, setOverrides] = useState<UserCapabilityOverride[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const resp = await userApi.listUsers({ page: 1, limit: 100 });
      const apiUsers = (resp.data as any)?.data || [];
      setUsers(
        apiUsers.map((u: UserProfile) => ({
          id: u.id,
          username: u.username,
          name: u.username,
          email: u.email || '',
          roles: u.role ? [u.role] : [],
          roleNames: u.role ? [u.role] : [],
          effectiveCount: 0,
        }))
      );
    } catch {
      message.error('加载用户列表失败');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // 加载能力列表和覆盖数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const capRes = await capabilityApi.list();
      const capData = (capRes.data as any)?.data || [];
      setCapabilities(capData.map((c: ApiCapability) => ({
        id: c.capability_id || c.id,
        name: c.name,
        description: c.description || '',
        category: c.category,
        riskLevel: (c.risk_level || 1) as 1 | 2 | 3 | 4,
        requiresApproval: c.requires_approval ?? false,
      })));

      // 加载所有用户的覆盖
      const allOverrides: UserCapabilityOverride[] = [];
      for (const user of users) {
        try {
          const res = await capabilityApi.getUserOverrides(user.id);
          const data = (res.data as any)?.data || [];
          for (const o of Array.isArray(data) ? data : []) {
            allOverrides.push({
              id: o.id || `${user.id}-${o.capability_id}`,
              userId: user.id,
              capabilityId: o.capability_id,
              capabilityName: o.capability_name || o.capability_id,
              capabilityCategory: '',
              granted: o.granted ?? true,
              reason: o.reason,
              grantedBy: o.granted_by || '',
              grantedAt: o.created_at || '',
              expiresAt: o.expires_at,
            });
          }
        } catch { /* skip user */ }
      }
      setOverrides(allOverrides);
    } catch {
      message.error('加载数据失败');
    }
    setLoading(false);
  }, [users]);

  useEffect(() => {
    loadUsers();
    loadData();
  }, []);

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
  const handleDeleteOverride = useCallback(async (overrideId: string) => {
    const override = overrides.find(o => o.id === overrideId);
    if (!override) return;
    try {
      await capabilityApi.removeUserOverride(override.userId, override.capabilityId);
      message.success('覆盖已撤销');
      loadData();
    } catch {
      message.error('撤销失败');
    }
  }, [overrides, loadData]);

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
    async (values: {
      capabilityId: string;
      granted: boolean;
      expiresAt: dayjs.Dayjs | null;
      reason: string;
    }) => {
      if (!selectedUser) return;

      try {
        await capabilityApi.addUserOverride(selectedUser.id, {
          capability_id: values.capabilityId,
          granted: values.granted,
          expires_in_hours: values.expiresAt ? values.expiresAt.diff(dayjs(), 'hour') : undefined,
          reason: values.reason,
        });
        setModalOpen(false);
        form.resetFields();
        message.success(`已${values.granted ? '授予' : '撤销'}用户能力`);
        loadData();
      } catch {
        message.error('操作失败');
      }
    },
    [selectedUser, form, loadData]
  );

  // 刷新
  const handleRefresh = useCallback(() => {
    loadData();
  }, [loadData]);

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
              <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: spacing[3] }}>
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
              {capabilities.map((cap) => (
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
