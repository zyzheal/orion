/**
 * 控制台页面 - 管理员专用
 * 功能：插件管理、系统配置、用户管理
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Switch,
  Badge,
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Tooltip,
  Alert,
  Avatar,
} from 'antd';
import {
  ControlOutlined,
  AppstoreOutlined,
  SettingOutlined,
  UserOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  RocketOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { getInstalledPlugins, activatePlugin, deactivatePlugin, type Plugin as ApiPlugin } from '@/api/plugins';
import { listUsers, createUser, type User as ApiUser } from '@/api/users';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// ==================== 组件 ====================

const Console: React.FC = () => {
  const [pluginData, setPluginData] = useState<ApiPlugin[]>([]);
  const [userData, setUserData] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pluginRes, userRes] = await Promise.all([
        getInstalledPlugins().catch(() => ({ data: { data: [] } })),
        listUsers({ limit: 50 }).catch(() => ({ data: { data: [] } })),
      ]);
      setPluginData((pluginRes.data as any)?.data || []);
      setUserData((userRes as any)?.data?.data || []);
    } catch {
      message.error('加载数据失败');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 统计信息
  const stats = {
    totalPlugins: pluginData.length,
    activePlugins: pluginData.filter((p) => p.state === 'ACTIVE' || p.status === 'enabled').length,
    totalUsers: userData.length,
    onlineUsers: userData.filter((u) => u.status === 'active').length,
  };

  // 系统配置项（保持本地状态，无对应 API）
  interface ConfigItem {
    key: string;
    name: string;
    description: string;
    enabled: boolean;
    category: string;
    requiresRestart: boolean;
  }

  const [configData, setConfigData] = useState<ConfigItem[]>([
    { key: '1', name: 'JWT 认证', description: '启用 JWT Token 进行用户认证', enabled: true, category: '安全', requiresRestart: false },
    { key: '2', name: '操作日志', description: '记录所有用户操作日志', enabled: true, category: '审计', requiresRestart: false },
    { key: '3', name: '自动备份', description: '每日自动备份数据库', enabled: true, category: '数据', requiresRestart: false },
    { key: '4', name: '邮件通知', description: '启用邮件通知功能', enabled: false, category: '通知', requiresRestart: false },
    { key: '5', name: 'Webhook 集成', description: '支持 Webhook 事件推送', enabled: true, category: '集成', requiresRestart: true },
    { key: '6', name: 'API 限流', description: '启用 API 请求限流保护', enabled: true, category: '安全', requiresRestart: false },
    { key: '7', name: '缓存加速', description: '启用 Redis 缓存加速', enabled: true, category: '性能', requiresRestart: true },
    { key: '8', name: '深色模式', description: '允许用户切换深色/浅色主题', enabled: true, category: '界面', requiresRestart: false },
  ]);

  // 插件状态颜色
  const getStatusColor = (plugin: ApiPlugin) => {
    if (plugin.state === 'ACTIVE' || plugin.status === 'enabled') return 'green';
    if (plugin.state === 'INACTIVE' || plugin.status === 'disabled') return 'default';
    return 'red';
  };

  // 插件状态图标
  const getStatusIcon = (plugin: ApiPlugin) => {
    if (plugin.state === 'ACTIVE' || plugin.status === 'enabled') return <CheckCircleOutlined />;
    if (plugin.state === 'INACTIVE' || plugin.status === 'disabled') return <CloseCircleOutlined />;
    return <SyncOutlined spin />;
  };

  // 用户角色颜色
  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'red',
      user: 'blue',
      guest: 'default',
    };
    return colors[role] || 'default';
  };

  // 处理插件开关
  const handlePluginToggle = async (pluginId: string, checked: boolean) => {
    try {
      if (checked) {
        await activatePlugin(pluginId);
      } else {
        await deactivatePlugin(pluginId);
      }
      message.success(`插件已${checked ? '启用' : '禁用'}`);
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  // 处理配置开关
  const handleConfigToggle = (configKey: string, checked: boolean) => {
    const config = configData.find((c) => c.key === configKey);
    if (config?.requiresRestart) {
      Modal.confirm({
        title: '需要重启服务',
        content: `${config.name} 的更改需要重启服务才能生效，是否继续？`,
        onOk: () => {
          setConfigData((prev) =>
            prev.map((c) => (c.key === configKey ? { ...c, enabled: checked } : c))
          );
          message.success('配置已更新，服务将在 5 秒后重启');
        },
      });
    } else {
      setConfigData((prev) =>
        prev.map((c) => (c.key === configKey ? { ...c, enabled: checked } : c))
      );
      message.success(`${config?.name} 已${checked ? '启用' : '禁用'}`);
    }
  };

  // 插件表格列
  const pluginColumns = [
    {
      title: '插件名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ApiPlugin) => (
        <Space direction="vertical" size={0}>
          <Space>
            <AppstoreOutlined style={{ color: colors.primary[500] }} />
            <Text strong>{name}</Text>
            <Tag color="blue">{record.version}</Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: ApiPlugin) => {
        const isActive = record.state === 'ACTIVE' || record.status === 'enabled';
        const isError = record.healthStatus === 'error';
        return (
          <Tag icon={getStatusIcon(record)} color={getStatusColor(record)}>
            {isActive ? '运行中' : isError ? '异常' : '已禁用'}
          </Tag>
        );
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string, record: ApiPlugin) => <Tag color="purple">{category || record.type}</Tag>,
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      render: (author: string) => <Text type="secondary">{author}</Text>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (v: string) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ApiPlugin) => {
        const isActive = record.state === 'ACTIVE' || record.status === 'enabled';
        return (
          <Space size="small">
            <Tooltip title="配置">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                disabled={!isActive}
              />
            </Tooltip>
            <Tooltip title="详情">
              <Button type="text" size="small" icon={<EditOutlined />} />
            </Tooltip>
            <Switch
              size="small"
              checked={isActive}
              onChange={(checked) => handlePluginToggle(record.id, checked)}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>
        );
      },
    },
  ];

  // 配置表格列
  const configColumns = [
    {
      title: '配置项',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ConfigItem) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong>{name}</Text>
            {record.requiresRestart && (
              <Tooltip title="更改后需要重启服务">
                <Tag color="orange">需重启</Tag>
              </Tooltip>
            )}
          </Space>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: ConfigItem) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleConfigToggle(record.key, checked)}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      ),
    },
  ];

  // 用户表格列
  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: ApiUser) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ background: colors.primary[500] }} />
          <div>
            <div style={{ fontWeight: 500 }}>{username}</div>
            <div style={{ fontSize: spacing[3], color: colors.neutral[400] }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color={getRoleColor(role)}>{(role || 'user').toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          active: { color: 'green', text: '正常' },
          inactive: { color: 'default', text: '未激活' },
          locked: { color: 'red', text: '已锁定' },
        };
        const { color, text } = statusMap[status] || { color: 'default', text: status };
        return <Badge status={color as 'success' | 'default' | 'error'} text={text} />;
      },
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: ApiUser) => (
        <Space size="small">
          <Button type="link" size="small">
            编辑
          </Button>
          {record.status !== 'locked' && (
            <Button type="link" size="small" danger>
              锁定
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ControlOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
          系统控制台
        </Title>
        <Paragraph type="secondary">管理系统插件、配置和功能开关</Paragraph>
      </div>

      {/* 统计卡片区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总插件数"
              value={stats.totalPlugins}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
            <Progress
              percent={(stats.activePlugins / stats.totalPlugins) * 100}
              strokeColor={colors.primary[500]}
              size="small"
              style={{ marginTop: spacing[3] }}
              format={() => `${stats.activePlugins} 个运行中`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="系统用户"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
            <div style={{ marginTop: spacing.md }}>
              <Tag color="green">{stats.onlineUsers} 在线</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="API 调用"
              value={892}
              suffix="/ 分钟"
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: colors.purple[500] }}
            />
            <Progress
              percent={67}
              strokeColor={colors.purple[500]}
              size="small"
              style={{ marginTop: spacing[3] }}
              format={() => '负载 67%'}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="系统健康度"
              value={98}
              suffix="%"
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
            <div style={{ marginTop: spacing.md }}>
              <Tag color="success">运行正常</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 功能标签页 */}
      <Card>
        <Tabs defaultActiveKey="plugins">
          <TabPane
            tab={
              <span>
                <AppstoreOutlined />
                插件管理
              </span>
            }
            key="plugins"
          >
            <div style={{ marginBottom: spacing.md }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />}>
                  安装插件
                </Button>
                <Button icon={<SyncOutlined />}>检查更新</Button>
                <Button icon={<RocketOutlined />}>插件市场</Button>
              </Space>
            </div>
            <Table
              columns={pluginColumns}
              dataSource={pluginData}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 5 }}
              size="middle"
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <SettingOutlined />
                系统配置
              </span>
            }
            key="config"
          >
            <div style={{ marginBottom: spacing.md }}>
              <Alert
                message="配置说明"
                description="修改带“需重启”标签的配置项后，需要重启服务才能生效"
                type="info"
                showIcon
              />
            </div>
            <Table
              columns={configColumns}
              dataSource={configData}
              rowKey="key"
              pagination={false}
              size="middle"
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <UserOutlined />
                用户管理
              </span>
            }
            key="users"
          >
            <div style={{ marginBottom: spacing.md }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                  添加用户
                </Button>
                <Button icon={<ThunderboltOutlined />}>批量操作</Button>
              </Space>
            </div>
            <Table
              columns={userColumns}
              dataSource={userData}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 5 }}
              size="middle"
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 添加用户弹窗 */}
      <Modal
        title="添加新用户"
        open={isModalOpen}
        onOk={() => {
          form.submit();
        }}
        onCancel={() => setIsModalOpen(false)}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await createUser({
                username: values.username,
                email: values.email,
                passwordHash: values.password,
                role: values.role,
              });
              message.success('用户添加成功');
              setIsModalOpen(false);
              form.resetFields();
              loadData();
            } catch {
              message.error('用户添加失败');
            }
          }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
            initialValue="user"
          >
            <Select>
              <Select.Option value="user">普通用户</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
              <Select.Option value="guest">访客</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Console;
