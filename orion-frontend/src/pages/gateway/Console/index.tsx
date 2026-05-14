/**
 * 控制台页面 - 管理员专用
 * 功能：插件管理、系统配置、用户管理
 */
import React, { useState } from 'react';
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

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// ==================== 模拟数据 ====================

// 插件数据
interface Plugin {
  key: string;
  name: string;
  version: string;
  description: string;
  author: string;
  status: 'active' | 'inactive' | 'error';
  category: string;
  updatedAt: string;
}

const plugins: Plugin[] = [
  {
    key: '1',
    name: 'Pipeline 引擎',
    version: 'v2.3.1',
    description: 'CI/CD Pipeline 执行引擎，支持多阶段任务编排',
    author: 'Orion Team',
    status: 'active',
    category: '核心',
    updatedAt: '2026-04-10',
  },
  {
    key: '2',
    name: '数据库连接器',
    version: 'v1.8.0',
    description: '支持 MySQL/PostgreSQL/MongoDB 等多种数据库',
    author: 'Orion Team',
    status: 'active',
    category: '数据',
    updatedAt: '2026-04-08',
  },
  {
    key: '3',
    name: '监控告警',
    version: 'v3.1.2',
    description: '系统监控、指标采集、告警通知',
    author: 'Orion Team',
    status: 'active',
    category: '监控',
    updatedAt: '2026-04-11',
  },
  {
    key: '4',
    name: '知识库管理',
    version: 'v2.0.5',
    description: '文档管理、知识分享、版本控制',
    author: 'Orion Team',
    status: 'inactive',
    category: '协作',
    updatedAt: '2026-04-05',
  },
  {
    key: '5',
    name: '代码质量分析',
    version: 'v1.2.0',
    description: '静态代码分析、代码规范检查',
    author: 'Community',
    status: 'error',
    category: '工具',
    updatedAt: '2026-03-28',
  },
];

// 系统配置项
interface ConfigItem {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  requiresRestart: boolean;
}

const configItems: ConfigItem[] = [
  {
    key: '1',
    name: 'JWT 认证',
    description: '启用 JWT Token 进行用户认证',
    enabled: true,
    category: '安全',
    requiresRestart: false,
  },
  {
    key: '2',
    name: '操作日志',
    description: '记录所有用户操作日志',
    enabled: true,
    category: '审计',
    requiresRestart: false,
  },
  {
    key: '3',
    name: '自动备份',
    description: '每日自动备份数据库',
    enabled: true,
    category: '数据',
    requiresRestart: false,
  },
  {
    key: '4',
    name: '邮件通知',
    description: '启用邮件通知功能',
    enabled: false,
    category: '通知',
    requiresRestart: false,
  },
  {
    key: '5',
    name: 'Webhook 集成',
    description: '支持 Webhook 事件推送',
    enabled: true,
    category: '集成',
    requiresRestart: true,
  },
  {
    key: '6',
    name: 'API 限流',
    description: '启用 API 请求限流保护',
    enabled: true,
    category: '安全',
    requiresRestart: false,
  },
  {
    key: '7',
    name: '缓存加速',
    description: '启用 Redis 缓存加速',
    enabled: true,
    category: '性能',
    requiresRestart: true,
  },
  {
    key: '8',
    name: '深色模式',
    description: '允许用户切换深色/浅色主题',
    enabled: true,
    category: '界面',
    requiresRestart: false,
  },
];

// 用户数据
interface User {
  key: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  status: 'active' | 'inactive' | 'locked';
  lastLogin: string;
  createdAt: string;
}

const users: User[] = [
  {
    key: '1',
    username: 'heal',
    email: 'heal@orion.design',
    role: 'admin',
    status: 'active',
    lastLogin: '2 分钟前',
    createdAt: '2026-01-15',
  },
  {
    key: '2',
    username: 'developer1',
    email: 'dev1@orion.design',
    role: 'user',
    status: 'active',
    lastLogin: '1 小时前',
    createdAt: '2026-02-20',
  },
  {
    key: '3',
    username: 'tester1',
    email: 'test@orion.design',
    role: 'user',
    status: 'active',
    lastLogin: '3 小时前',
    createdAt: '2026-03-10',
  },
  {
    key: '4',
    username: 'guest_user',
    email: 'guest@orion.design',
    role: 'guest',
    status: 'inactive',
    lastLogin: '30 天前',
    createdAt: '2026-01-01',
  },
];

// ==================== 组件 ====================

const Console: React.FC = () => {
  const [pluginData, setPluginData] = useState<Plugin[]>(plugins);
  const [configData, setConfigData] = useState<ConfigItem[]>(configItems);
  const [_userData, _setUserData] = useState<User[]>(users);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 统计信息
  const stats = {
    totalPlugins: plugins.length,
    activePlugins: plugins.filter((p) => p.status === 'active').length,
    totalUsers: users.length,
    onlineUsers: 12,
  };

  // 插件状态颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'green',
      inactive: 'default',
      error: 'red',
    };
    return colors[status] || 'default';
  };

  // 插件状态图标
  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      active: <CheckCircleOutlined />,
      inactive: <CloseCircleOutlined />,
      error: <SyncOutlined spin />,
    };
    return icons[status] || null;
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
  const handlePluginToggle = (pluginKey: string, checked: boolean) => {
    setPluginData((prev) =>
      prev.map((p) => (p.key === pluginKey ? { ...p, status: checked ? 'active' : 'inactive' } : p))
    );
    const plugin = pluginData.find((p) => p.key === pluginKey);
    message.success(`插件 "${plugin?.name}" 已${checked ? '启用' : '禁用'}`);
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
      render: (name: string, record: Plugin) => (
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
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag icon={getStatusIcon(status)} color={getStatusColor(status)}>
          {status === 'active' ? '运行中' : status === 'inactive' ? '已禁用' : '异常'}
        </Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="purple">{category}</Tag>,
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
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Plugin) => (
        <Space size="small">
          <Tooltip title="配置">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              disabled={record.status === 'inactive'}
            />
          </Tooltip>
          <Tooltip title="详情">
            <Button type="text" size="small" icon={<EditOutlined />} />
          </Tooltip>
          <Switch
            size="small"
            checked={record.status === 'active'}
            onChange={(checked) => handlePluginToggle(record.key, checked)}
            checkedChildren="开"
            unCheckedChildren="关"
          />
        </Space>
      ),
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
      render: (username: string, record: User) => (
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
      render: (role: string) => <Tag color={getRoleColor(role)}>{role.toUpperCase()}</Tag>,
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
      dataIndex: 'lastLogin',
      key: 'lastLogin',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: User) => (
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
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <ControlOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
          系统控制台
        </Title>
        <Paragraph type="secondary">管理系统插件、配置和功能开关</Paragraph>
      </div>

      {/* 统计卡片区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
              style={{ marginTop: 12 }}
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
            <div style={{ marginTop: 16 }}>
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
              style={{ marginTop: 12 }}
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
            <div style={{ marginTop: 16 }}>
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
            <div style={{ marginBottom: 16 }}>
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
            <div style={{ marginBottom: 16 }}>
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
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                  添加用户
                </Button>
                <Button icon={<ThunderboltOutlined />}>批量操作</Button>
              </Space>
            </div>
            <Table
              columns={userColumns}
              dataSource={_userData}
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
          onFinish={() => {
            setIsModalOpen(false);
            message.success('用户添加成功');
            form.resetFields();
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
