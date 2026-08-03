/**
 * Capability Admin - 能力权限配置页面
 *
 * 提供能力树管理、角色映射、命令映射、临时权限管理等功能的 UI
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Tag,
  Space,
  message,
  Tabs,
  Badge,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  capabilityApi,
  type Capability,
  type TemporaryPermission,
  type CapabilityAuditLog,
} from '@/api/capability';
import { spacing } from '@/tokens';

const { TextArea } = Input;

// 风险等级颜色
const RISK_COLORS = {
  1: 'green',
  2: 'blue',
  3: 'orange',
  4: 'red',
};

const RISK_LABELS = {
  1: '低风险',
  2: '中风险',
  3: '高风险',
  4: '最高风险',
};

export const CapabilityAdmin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<Capability | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [form] = Form.useForm();

  // Temporary permissions state
  const [tempPerms, setTempPerms] = useState<TemporaryPermission[]>([]);
  const [tempPermLoading, setTempPermLoading] = useState(false);
  const [tempPermModalVisible, setTempPermModalVisible] = useState(false);
  const [tempPermForm] = Form.useForm();

  // Audit log state
  const [auditLogs, setAuditLogs] = useState<CapabilityAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);

  // Permission request state
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestForm] = Form.useForm();

  // Load capabilities
  const loadCapabilities = async () => {
    setLoading(true);
    try {
      const result = await capabilityApi.list();
      setCapabilities((result.data as unknown as Capability[]) || []);
    } catch (error) {
      message.error('加载能力列表失败');
    } finally {
      setLoading(false);
    }
  };

  // Load temporary permissions
  const loadTempPerms = async () => {
    setTempPermLoading(true);
    try {
      // 这里用当前用户ID，实际应从 auth store 获取
      const result = await capabilityApi.getUserTemporaryPermissions('current-user');
      setTempPerms((result.data as unknown as TemporaryPermission[]) || []);
    } catch (error) {
      // 静默失败，可能还没有临时权限
    } finally {
      setTempPermLoading(false);
    }
  };

  // Load audit logs
  const loadAuditLogs = async (page = 1) => {
    setAuditLoading(true);
    try {
      const result = await capabilityApi.getAuditLogs({ limit: 20, offset: (page - 1) * 20 });
      const payload = result.data as { logs?: CapabilityAuditLog[]; total?: number } | null;
      setAuditLogs(payload?.logs || []);
      setAuditTotal(payload?.total || 0);
      setAuditPage(page);
    } catch (error) {
      message.error('加载审计日志失败');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    loadCapabilities();
    loadTempPerms();
    loadAuditLogs();
  }, []);

  // Create capability
  const handleCreate = () => {
    setModalType('create');
    form.resetFields();
    form.setFieldValue('risk_level', 1);
    form.setFieldValue('requires_approval', false);
    setModalVisible(true);
  };

  // Edit capability
  const handleEdit = (record: Capability) => {
    setModalType('edit');
    setSelectedCapability(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // Delete capability
  const handleDelete = async (record: Capability) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除能力 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await capabilityApi.delete(record.capability_id);
          message.success('删除成功');
          loadCapabilities();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // Submit capability form
  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (modalType === 'create') {
        await capabilityApi.create(values);
        message.success('创建成功');
      } else {
        if (!selectedCapability) return;
        await capabilityApi.update(selectedCapability.capability_id, values);
        message.success('更新成功');
      }
      setModalVisible(false);
      loadCapabilities();
    } catch (error: unknown) {
      message.error((error as Error).message || '操作失败');
    }
  };

  // Grant temporary permission
  const handleGrantTempPerm = async () => {
    const values = await tempPermForm.validateFields();
    try {
      await capabilityApi.grantTemporary(values);
      message.success('临时权限已授予');
      setTempPermModalVisible(false);
      loadTempPerms();
    } catch (error: unknown) {
      message.error((error as Error).message || '授予失败');
    }
  };

  // Revoke temporary permission
  const handleRevokeTempPerm = async (id: number) => {
    try {
      await capabilityApi.revokeTemporary(id, '手动撤销');
      message.success('临时权限已撤销');
      loadTempPerms();
    } catch (error: unknown) {
      message.error((error as Error).message || '撤销失败');
    }
  };

  // Submit permission request
  const handleRequestPermission = async () => {
    const values = await requestForm.validateFields();
    try {
      await capabilityApi.requestPermission(values);
      message.success('权限申请已提交，等待审批');
      setRequestModalVisible(false);
    } catch (error: unknown) {
      message.error((error as Error).message || '申请失败');
    }
  };

  // Cleanup expired permissions
  const handleCleanup = async () => {
    try {
      const result = await capabilityApi.cleanup();
      const payload = result.data as { cleaned?: number } | null;
      message.success(`清理完成，共清理 ${payload?.cleaned || 0} 条过期权限`);
      loadTempPerms();
      loadAuditLogs();
    } catch (error: unknown) {
      message.error((error as Error).message || '清理失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '能力标识',
      dataIndex: 'capability_id',
      key: 'capability_id',
      width: 200,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 100,
      render: (level: number) => (
        <Badge
          color={RISK_COLORS[level as keyof typeof RISK_COLORS]}
          text={RISK_LABELS[level as keyof typeof RISK_LABELS]}
        />
      ),
    },
    {
      title: '需要审批',
      dataIndex: 'requires_approval',
      key: 'requires_approval',
      width: 100,
      render: (val: boolean) => (val ? <Tag color="orange">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Capability) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 临时权限列
  const tempPermColumns = [
    {
      title: '能力标识',
      dataIndex: 'capability_id',
      key: 'capability_id',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '环境',
      dataIndex: 'environment_suffix',
      key: 'environment_suffix',
      render: (val: string) => val || '-',
    },
    {
      title: '授予人',
      dataIndex: 'granted_by',
      key: 'granted_by',
    },
    {
      title: '授予时间',
      dataIndex: 'granted_at',
      key: 'granted_at',
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (val: string) => (
        <Tag icon={<ClockCircleOutlined />} color={new Date(val) < new Date() ? 'error' : 'processing'}>
          {new Date(val).toLocaleString()}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: TemporaryPermission) => (
        !record.revoked_at && (
          <Popconfirm
            title="确认撤销"
            description="确定要撤销此临时权限吗？"
            onConfirm={() => handleRevokeTempPerm(record.id)}
          >
            <Button type="link" size="small" danger>撤销</Button>
          </Popconfirm>
        )
      ),
    },
  ];

  // 审计日志列
  const auditColumns = [
    {
      title: '用户',
      dataIndex: 'user_id',
      key: 'user_id',
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (val: string) => {
        const colorMap: Record<string, string> = { granted: 'green', revoked: 'red', expired: 'orange', requested: 'blue', approved: 'cyan', rejected: 'magenta' };
        return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
      },
    },
    {
      title: '能力标识',
      dataIndex: 'capability_id',
      key: 'capability_id',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString(),
    },
  ];

  const tabItems = [
    {
      key: 'capabilities',
      label: (
        <span><SafetyCertificateOutlined /> 能力管理</span>
      ),
      children: (
        <Table
          columns={columns}
          dataSource={capabilities}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'temporary',
      label: (
        <span><ClockCircleOutlined /> 临时权限</span>
      ),
      children: (
        <Table
          columns={tempPermColumns}
          dataSource={tempPerms}
          rowKey="id"
          loading={tempPermLoading}
          pagination={{ pageSize: 20 }}
        />
      ),
    },
    {
      key: 'audit',
      label: (
        <span><AuditOutlined /> 审计日志</span>
      ),
      children: (
        <Table
          columns={auditColumns}
          dataSource={auditLogs}
          rowKey="id"
          loading={auditLoading}
          pagination={{
            pageSize: 20,
            total: auditTotal,
            current: auditPage,
            onChange: (page) => loadAuditLogs(page),
          }}
        />
      ),
    },
  ];

  return (
    <div className="capability-admin" style={{ padding: spacing.md }}>
      <Tabs
        defaultActiveKey="capabilities"
        items={tabItems}
        tabBarExtraContent={
          <Space>
            <Button onClick={handleCleanup} icon={<ClockCircleOutlined />}>
              清理过期
            </Button>
            <Button onClick={() => {
              tempPermForm.resetFields();
              tempPermForm.setFieldValue('expires_in_hours', 8);
              setTempPermModalVisible(true);
            }} icon={<PlusOutlined />}>
              授予临时权限
            </Button>
            <Button type="primary" onClick={() => {
              requestForm.resetFields();
              requestForm.setFieldValue('duration_hours', 8);
              setRequestModalVisible(true);
            }} icon={<SendOutlined />}>
              申请权限
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建能力
            </Button>
          </Space>
        }
      />

      {/* 创建/编辑能力弹窗 */}
      <Modal
        title={modalType === 'create' ? '新建能力' : '编辑能力'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="capability_id"
            label="能力标识"
            rules={[{ required: true, message: '请输入能力标识' }]}
          >
            <Input placeholder="如: chatops.command.execute" disabled={modalType === 'edit'} />
          </Form.Item>

          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如: 执行 ChatOps 命令" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={2} placeholder="能力的详细描述" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              <Select.Option value="chatops">ChatOps</Select.Option>
              <Select.Option value="pipeline">流水线</Select.Option>
              <Select.Option value="deployment">部署</Select.Option>
              <Select.Option value="config">配置</Select.Option>
              <Select.Option value="admin">管理</Select.Option>
              <Select.Option value="ai">AI 能力</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="parent_capability_id"
            label="父能力"
          >
            <Select placeholder="选择父能力（可选）" allowClear>
              {capabilities.map(cap => (
                <Select.Option key={cap.capability_id} value={cap.capability_id}>
                  {cap.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="risk_level"
            label="风险等级"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={4} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="requires_approval"
            label="是否需要审批"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="approval_role"
            label="审批角色"
          >
            <Input placeholder="审批所需的角色名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 授予临时权限弹窗 */}
      <Modal
        title="授予临时权限"
        open={tempPermModalVisible}
        onOk={handleGrantTempPerm}
        onCancel={() => setTempPermModalVisible(false)}
        width={500}
      >
        <Form form={tempPermForm} layout="vertical">
          <Form.Item
            name="user_id"
            label="用户 ID"
            rules={[{ required: true, message: '请输入用户 ID' }]}
          >
            <Input placeholder="输入要授予的用户 ID" />
          </Form.Item>

          <Form.Item
            name="capability_id"
            label="能力标识"
            rules={[{ required: true, message: '请选择能力' }]}
          >
            <Select placeholder="选择能力" showSearch>
              {capabilities.map(cap => (
                <Select.Option key={cap.capability_id} value={cap.capability_id}>
                  {cap.name} ({cap.capability_id})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="environment_suffix"
            label="环境后缀"
          >
            <Input placeholder="如: prod, staging" />
          </Form.Item>

          <Form.Item
            name="expires_in_hours"
            label="有效时长（小时）"
            rules={[{ required: true, message: '请输入有效时长' }]}
          >
            <InputNumber min={1} max={720} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="原因"
          >
            <TextArea rows={2} placeholder="授予临时权限的原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 申请权限弹窗 */}
      <Modal
        title="申请权限"
        open={requestModalVisible}
        onOk={handleRequestPermission}
        onCancel={() => setRequestModalVisible(false)}
        width={500}
      >
        <Form form={requestForm} layout="vertical">
          <Form.Item
            name="capability_id"
            label="能力标识"
            rules={[{ required: true, message: '请选择能力' }]}
          >
            <Select placeholder="选择要申请的能力" showSearch>
              {capabilities.map(cap => (
                <Select.Option key={cap.capability_id} value={cap.capability_id}>
                  {cap.name} ({cap.capability_id})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="environment_suffix"
            label="环境"
          >
            <Input placeholder="如: prod, staging" />
          </Form.Item>

          <Form.Item
            name="duration_hours"
            label="申请时长（小时）"
            rules={[{ required: true, message: '请输入申请时长' }]}
          >
            <InputNumber min={1} max={720} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请原因"
            rules={[{ required: true, message: '请输入申请原因' }]}
          >
            <TextArea rows={3} placeholder="请说明申请此权限的原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CapabilityAdmin;