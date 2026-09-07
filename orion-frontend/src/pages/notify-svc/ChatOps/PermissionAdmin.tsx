/**
 * ChatOps 权限管理后台
 * 角色管理、命令权限、环境权限配置
 */
import React, { useState, useEffect } from 'react';
import {
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
  Typography,
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
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import { chatopsAdminApi } from '@/api/chatops-admin';
import { useQuery } from '@/providers/QueryProvider';

const { Text } = Typography;

interface RoleRecord {
  id?: string;
  name?: string;
  description?: string;
  command_count?: number;
  user_count?: number;
}

interface CommandPermissionRecord {
  id?: string;
  command?: string;
  description?: string;
  capability?: string;
  risk_level?: number;
  requires_approval?: boolean;
  assigned_roles?: string[];
}

interface EnvPermissionRecord {
  id?: string;
  environment?: string;
  description?: string;
  allowed_commands?: string[];
  rate_limit?: number;
  require_approval?: boolean;
  assigned_roles?: string[];
}

// ============== Role Management Tab ==============
const RoleManagementTab: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [form] = Form.useForm();

  const {
    data: roles = [],
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<RoleRecord[]>({
    queryKey: ['chat-roles'],
    queryFn: async () => {
      const res = await chatopsAdminApi.getRoles();
      return (res as { data?: { data?: RoleRecord[] } })?.data?.data ?? [];
    },
    staleTime: 30_000,
  });

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) message.error('获取角色列表失败');
  }, [isError, error]);

  const handleAdd = () => {
    setEditingRole(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (role: RoleRecord) => {
    setEditingRole(role);
    form.setFieldsValue(role);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await chatopsAdminApi.deleteRole(id);
      message.success('角色已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingRole) {
        await chatopsAdminApi.updateRole(editingRole.id as string, values);
        message.success('角色已更新');
      } else {
        await chatopsAdminApi.createRole(values);
        message.success('角色已创建');
      }
      setModalVisible(false);
      loadData();
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<RoleRecord> = [
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
      dataIndex: 'command_count',
      key: 'command_count',
      width: 100,
      align: 'center',
      render: (v: number) => v || 0,
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      align: 'center',
      render: (v: number) => v || 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此角色?" onConfirm={() => handleDelete(record.id as string)}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text type="secondary">管理 ChatOps 命令执行权限角色</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
            刷新
          </Button>
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
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
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
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<CommandPermissionRecord | null>(null);
  const [form] = Form.useForm();

  const {
    data,
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<{ permissions: CommandPermissionRecord[]; roles: RoleRecord[] }>({
    queryKey: ['chat-command-permissions'],
    queryFn: async () => {
      const [permRes, roleRes] = await Promise.all([
        chatopsAdminApi.getCommandPermissions(),
        chatopsAdminApi.getRoles(),
      ]);
      return {
        permissions:
          (permRes as { data?: { data?: CommandPermissionRecord[] } })?.data?.data ?? [],
        roles: (roleRes as { data?: { data?: RoleRecord[] } })?.data?.data ?? [],
      };
    },
    staleTime: 30_000,
  });
  const permissions = data?.permissions ?? [];
  const roles = data?.roles ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) message.error('获取权限列表失败');
  }, [isError, error]);

  const riskLevelColors: Record<number, string> = {
    1: colors.success[500],
    2: colors.info[500],
    3: colors.warning[500],
    4: colors.error[500],
  };

  const riskLevelLabels: Record<number, string> = {
    1: '低风险',
    2: '中风险',
    3: '高风险',
    4: '极高风险',
  };

  const handleEdit = (permission: CommandPermissionRecord) => {
    setEditingPermission(permission);
    form.setFieldsValue({
      ...permission,
      role_ids: permission.assigned_roles || [],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingPermission) {
        await chatopsAdminApi.updateCommandPermission(editingPermission.id as string, {
          ...values,
          role_ids: values.role_ids || [],
        });
        message.success('权限已更新');
      }
      setModalVisible(false);
      loadData();
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<CommandPermissionRecord> = [
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      render: (cmd: string) => <Tag style={{ fontFamily: 'monospace' }}>/{cmd}</Tag>,
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
      render: (cap: string) => (
        <Text code style={{ fontSize: 11 }}>
          {cap}
        </Text>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (level: number) => (
        <Badge color={riskLevelColors[level]} text={riskLevelLabels[level]} />
      ),
    },
    {
      title: '需审批',
      dataIndex: 'requires_approval',
      key: 'requires_approval',
      width: 80,
      render: (required: boolean) => (required ? <Tag color="purple">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => handleEdit(record)}
        >
          配置
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={permissions}
        rowKey="id"
        loading={loading}
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
            <Input prefix="/" placeholder="deploy" />
          </Form.Item>
          <Form.Item name="capability" label="Capability" rules={[{ required: true }]}>
            <Input placeholder="pipeline_operations.trigger" />
          </Form.Item>
          <Form.Item name="risk_level" label="风险等级" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '低风险 (1)', value: 1 },
                { label: '中风险 (2)', value: 2 },
                { label: '高风险 (3)', value: 3 },
                { label: '极高风险 (4)', value: 4 },
              ]}
            />
          </Form.Item>
          <Form.Item name="requires_approval" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="role_ids" label="授权角色">
            <Select
              mode="multiple"
              placeholder="选择授权角色"
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============== Environment Permission Tab ==============
const EnvironmentPermissionTab: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<EnvPermissionRecord | null>(null);
  const [form] = Form.useForm();

  const {
    data,
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<{ permissions: EnvPermissionRecord[]; roles: RoleRecord[] }>({
    queryKey: ['chat-environment-permissions'],
    queryFn: async () => {
      const [permRes, roleRes] = await Promise.all([
        chatopsAdminApi.getEnvironmentPermissions(),
        chatopsAdminApi.getRoles(),
      ]);
      return {
        permissions:
          (permRes as { data?: { data?: EnvPermissionRecord[] } })?.data?.data ?? [],
        roles: (roleRes as { data?: { data?: RoleRecord[] } })?.data?.data ?? [],
      };
    },
    staleTime: 30_000,
  });
  const permissions = data?.permissions ?? [];
  const roles = data?.roles ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) message.error('获取环境权限列表失败');
  }, [isError, error]);

  const envColors: Record<string, string> = {
    prod: colors.error[500],
    staging: colors.warning[500],
    dev: colors.success[500],
  };

  const handleEdit = (permission: EnvPermissionRecord) => {
    setEditingPermission(permission);
    form.setFieldsValue({
      ...permission,
      role_ids: permission.assigned_roles || [],
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingPermission) {
        await chatopsAdminApi.updateEnvironmentPermission(editingPermission.id as string, {
          ...values,
          role_ids: values.role_ids || [],
        });
        message.success('环境权限已更新');
      }
      setModalVisible(false);
      loadData();
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<EnvPermissionRecord> = [
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: string) => (
        <Tag color={envColors[env]} style={{ textTransform: 'uppercase' }}>
          {env}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '允许命令',
      dataIndex: 'allowed_commands',
      key: 'allowed_commands',
      render: (cmds: string[]) => (
        <Space wrap>
          {(cmds || []).slice(0, 3).map((c) => (
            <Tag key={c}>{c}</Tag>
          ))}
          {(cmds || []).length > 3 && <Tag>+{(cmds || []).length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: '限流(次/分钟)',
      dataIndex: 'rate_limit',
      key: 'rate_limit',
      width: 120,
      render: (limit: number) => limit || '-',
    },
    {
      title: '需审批',
      dataIndex: 'require_approval',
      key: 'require_approval',
      width: 80,
      render: (required: boolean) => (required ? <Tag color="purple">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => handleEdit(record)}
        >
          配置
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={permissions}
        rowKey="id"
        loading={loading}
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
          <Form.Item name="rate_limit" label="限流 (次/分钟)">
            <Input type="number" placeholder="10" />
          </Form.Item>
          <Form.Item name="require_approval" label="需要审批" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="role_ids" label="授权角色">
            <Select
              mode="multiple"
              placeholder="选择授权角色"
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
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
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
};

export default PermissionAdmin;