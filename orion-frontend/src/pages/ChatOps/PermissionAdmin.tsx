/**
 * ChatOps 权限管理后台
 * 角色管理、命令权限、环境权限配置
 */
import React, { useState, useEffect } from 'react';
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
  message,
  Popconfirm,
  Badge,
  Tooltip,
  Transfer,
  Typography,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  UserOutlined,
  SafetyOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ============== Types ==============
export interface ChatOpsRole {
  id: string;
  name: string;
  description: string;
  commandCount: number;
  userCount: number;
  createdAt: string;
  permissions: string[];
}

export interface CommandPermission {
  id: string;
  command: string;
  description: string;
  capability: string;
  riskLevel: 1 | 2 | 3 | 4;
  requiresApproval: boolean;
  enabledEnvironments: string[];
  assignedRoles: string[];
}

export interface EnvironmentPermission {
  id: string;
  environment: string;
  description: string;
  allowedCommands: string[];
  deniedCommands: string[];
  rateLimit: number;
  requireApproval: boolean;
  assignedRoles: string[];
}

// ============== Mock Data ==============
const MOCK_ROLES: ChatOpsRole[] = [
  {
    id: 'role-1',
    name: '运维管理员',
    description: '拥有全部 ChatOps 操作权限',
    commandCount: 50,
    userCount: 5,
    createdAt: '2026-01-15',
    permissions: ['*'],
  },
  {
    id: 'role-2',
    name: '开发者',
    description: '开发环境操作权限',
    commandCount: 30,
    userCount: 20,
    createdAt: '2026-02-01',
    permissions: ['deploy:dev', 'restart:dev', 'logs:dev'],
  },
  {
    id: 'role-3',
    name: '只读用户',
    description: '仅查看权限',
    commandCount: 0,
    userCount: 15,
    createdAt: '2026-03-01',
    permissions: ['read'],
  },
];

const MOCK_COMMAND_PERMISSIONS: CommandPermission[] = [
  {
    id: 'cmd-1',
    command: '/deploy',
    description: '部署命令',
    capability: 'pipeline_operations.trigger',
    riskLevel: 2,
    requiresApproval: false,
    enabledEnvironments: ['dev', 'staging'],
    assignedRoles: ['role-1', 'role-2'],
  },
  {
    id: 'cmd-2',
    command: '/deploy env=prod',
    description: '生产环境部署',
    capability: 'deployment_operations.deploy_prod',
    riskLevel: 4,
    requiresApproval: true,
    enabledEnvironments: ['prod'],
    assignedRoles: ['role-1'],
  },
  {
    id: 'cmd-3',
    command: '/restart',
    description: '重启服务',
    capability: 'infrastructure_operations.env_restart',
    riskLevel: 3,
    requiresApproval: false,
    enabledEnvironments: ['dev', 'staging', 'prod'],
    assignedRoles: ['role-1'],
  },
  {
    id: 'cmd-4',
    command: '/rollback',
    description: '回滚操作',
    capability: 'deployment_operations.rollback',
    riskLevel: 4,
    requiresApproval: true,
    enabledEnvironments: ['prod'],
    assignedRoles: ['role-1'],
  },
  {
    id: 'cmd-5',
    command: '/kubectl',
    description: 'K8s 操作',
    capability: 'chatops_advanced.command.kubectl',
    riskLevel: 4,
    requiresApproval: true,
    enabledEnvironments: ['dev', 'staging'],
    assignedRoles: ['role-1'],
  },
];

const MOCK_ENVIRONMENT_PERMISSIONS: EnvironmentPermission[] = [
  {
    id: 'env-1',
    environment: 'prod',
    description: '生产环境',
    allowedCommands: ['/deploy', '/restart', '/rollback'],
    deniedCommands: ['/kubectl delete'],
    rateLimit: 10,
    requireApproval: true,
    assignedRoles: ['role-1'],
  },
  {
    id: 'env-2',
    environment: 'staging',
    description: '预发环境',
    allowedCommands: ['/deploy', '/restart', '/kubectl'],
    deniedCommands: [],
    rateLimit: 50,
    requireApproval: false,
    assignedRoles: ['role-1', 'role-2'],
  },
  {
    id: 'env-3',
    environment: 'dev',
    description: '开发环境',
    allowedCommands: ['*'],
    deniedCommands: [],
    rateLimit: 100,
    requireApproval: false,
    assignedRoles: ['role-1', 'role-2', 'role-3'],
  },
];

// ============== Role Management Tab ==============
const RoleManagementTab: React.FC = () => {
  const [roles, setRoles] = useState<ChatOpsRole[]>(MOCK_ROLES);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<ChatOpsRole | null>(null);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setEditingRole(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (role: ChatOpsRole) => {
    setEditingRole(role);
    form.setFieldsValue(role);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    setRoles(roles.filter(r => r.id !== id));
    message.success('角色已删除');
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingRole) {
        setRoles(roles.map(r => r.id === editingRole.id ? { ...r, ...values } : r));
        message.success('角色已更新');
      } else {
        const newRole: ChatOpsRole = {
          id: `role-${Date.now()}`,
          ...values,
          commandCount: 0,
          userCount: 0,
          createdAt: new Date().toISOString().split('T')[0],
          permissions: [],
        };
        setRoles([...roles, newRole]);
        message.success('角色已创建');
      }
      setModalVisible(false);
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<ChatOpsRole> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '命令数',
      dataIndex: 'commandCount',
      key: 'commandCount',
      width: 100,
      align: 'center',
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      align: 'center',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此角色?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text type="secondary">管理 ChatOps 命令执行权限角色</Text>
        <Space>
          <Button icon={<ReloadOutlined />}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建角色
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="如：运维管理员" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="角色描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============== Command Permission Tab ==============
const CommandPermissionTab: React.FC = () => {
  const [permissions, setPermissions] = useState<CommandPermission[]>(MOCK_COMMAND_PERMISSIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<CommandPermission | null>(null);
  const [form] = Form.useForm();

  const riskLevelColors: Record<number, string> = {
    1: 'green',
    2: 'blue',
    3: 'orange',
    4: 'red',
  };

  const riskLevelLabels: Record<number, string> = {
    1: '低风险',
    2: '中风险',
    3: '高风险',
    4: '极高风险',
  };

  const handleEdit = (permission: CommandPermission) => {
    setEditingPermission(permission);
    form.setFieldsValue({
      ...permission,
      roles: permission.assignedRoles,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingPermission) {
        setPermissions(permissions.map(p =>
          p.id === editingPermission.id
            ? { ...p, ...values, assignedRoles: values.roles || [] }
            : p
        ));
        message.success('权限已更新');
      }
      setModalVisible(false);
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<CommandPermission> = [
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      render: (cmd: string) => <Tag style={{ fontFamily: 'monospace' }}>{cmd}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Capability',
      dataIndex: 'capability',
      key: 'capability',
      render: (cap: string) => <Text code style={{ fontSize: 11 }}>{cap}</Text>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (level: number) => (
        <Badge color={riskLevelColors[level]} text={riskLevelLabels[level]} />
      ),
    },
    {
      title: '需审批',
      dataIndex: 'requiresApproval',
      key: 'requiresApproval',
      width: 80,
      render: (required: boolean) => (
        required ? <Tag color="purple">是</Tag> : <Tag>否</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => handleEdit(record)}>
          配置
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="命令-Capability 映射管理"
        description="配置 ChatOps 命令与 Capability 能力的映射关系，控制命令执行权限。风险等级 4 的命令默认需要审批。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={permissions}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title="配置命令权限"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="command" label="命令" rules={[{ required: true }]}>
            <Input placeholder="/deploy" />
          </Form.Item>
          <Form.Item name="capability" label="Capability" rules={[{ required: true }]}>
            <Input placeholder="pipeline_operations.trigger" />
          </Form.Item>
          <Form.Item name="riskLevel" label="风险等级" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '低风险 (1)', value: 1 },
                { label: '中风险 (2)', value: 2 },
                { label: '高风险 (3)', value: 3 },
                { label: '极高风险 (4)', value: 4 },
              ]}
            />
          </Form.Item>
          <Form.Item name="requiresApproval" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="roles" label="授权角色">
            <Select
              mode="multiple"
              placeholder="选择授权角色"
              options={MOCK_ROLES.map(r => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============== Environment Permission Tab ==============
const EnvironmentPermissionTab: React.FC = () => {
  const [permissions, setPermissions] = useState<EnvironmentPermission[]>(MOCK_ENVIRONMENT_PERMISSIONS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<EnvironmentPermission | null>(null);
  const [form] = Form.useForm();

  const envColors: Record<string, string> = {
    prod: 'red',
    staging: 'orange',
    dev: 'green',
  };

  const handleEdit = (permission: EnvironmentPermission) => {
    setEditingPermission(permission);
    form.setFieldsValue({
      ...permission,
      roles: permission.assignedRoles,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingPermission) {
        setPermissions(permissions.map(p =>
          p.id === editingPermission.id
            ? { ...p, ...values, assignedRoles: values.roles || [] }
            : p
        ));
        message.success('环境权限已更新');
      }
      setModalVisible(false);
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<EnvironmentPermission> = [
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: string) => (
        <Tag color={envColors[env]} style={{ textTransform: 'uppercase' }}>{env}</Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '允许命令',
      dataIndex: 'allowedCommands',
      key: 'allowedCommands',
      render: (cmds: string[]) => (
        <Space wrap>
          {cmds.slice(0, 3).map(c => <Tag key={c}>{c}</Tag>)}
          {cmds.length > 3 && <Tag>+{cmds.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '限流(次/分钟)',
      dataIndex: 'rateLimit',
      key: 'rateLimit',
      width: 120,
      render: (limit: number) => limit,
    },
    {
      title: '需审批',
      dataIndex: 'requireApproval',
      key: 'requireApproval',
      width: 80,
      render: (required: boolean) => (
        required ? <Tag color="purple">是</Tag> : <Tag>否</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => handleEdit(record)}>
          配置
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="环境级权限配置"
        description="配置不同环境的命令执行权限、限流规则和审批要求。生产环境默认需要更严格的权限控制。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={permissions}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title="配置环境权限"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="environment" label="环境" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '生产环境 (prod)', value: 'prod' },
                { label: '预发环境 (staging)', value: 'staging' },
                { label: '开发环境 (dev)', value: 'dev' },
              ]}
            />
          </Form.Item>
          <Form.Item name="rateLimit" label="限流 (次/分钟)">
            <Input type="number" placeholder="10" />
          </Form.Item>
          <Form.Item name="requireApproval" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="roles" label="授权角色">
            <Select
              mode="multiple"
              placeholder="选择授权角色"
              options={MOCK_ROLES.map(r => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============== Main Component ==============
const PermissionAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('role');

  const tabItems = [
    {
      key: 'role',
      label: (
        <span>
          <UserOutlined /> 角色管理
        </span>
      ),
      children: <RoleManagementTab />,
    },
    {
      key: 'command',
      label: (
        <span>
          <SafetyOutlined /> 命令权限
        </span>
      ),
      children: <CommandPermissionTab />,
    },
    {
      key: 'environment',
      label: (
        <span>
          <EnvironmentOutlined /> 环境权限
        </span>
      ),
      children: <EnvironmentPermissionTab />,
    },
  ];

  return (
    <div style={{ padding: '0 0 16px' }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px', color: colors.light.text.primary }}>权限管理</span>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          ChatOps 命令权限配置 - 角色管理、命令权限映射、环境级控制
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </div>
  );
};

export default PermissionAdmin;