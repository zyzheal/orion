/**
 * Code Management - Branch Policy List Page
 * Table display with Modal CRUD for branch protection policies
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  InputNumber,
  Checkbox,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, BranchesOutlined,} from '@ant-design/icons';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import {
  getBranchPolicies,
  createBranchPolicy,
  updateBranchPolicy,
  deleteBranchPolicy,
  type BranchPolicy,
  type CreateBranchPolicyInput,
  type UpdateBranchPolicyInput,
} from '@/api/code-mgmt';

const { Title, Text } = Typography;

const BranchPolicyList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [form] = Form.useForm();

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getBranchPolicies();
      const data = response.data as BranchPolicy[];
      setPolicies(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载分支策略失败：${error.message}`);
      } else {
        message.error('加载分支策略失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const openCreateModal = () => {
    setEditingPolicy(null);
    form.setFieldsValue({
      branchPattern: '',
      minApprovals: 1,
      requireBuildPass: true,
      requireTestPass: true,
      enabled: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (policy: any) => {
    setEditingPolicy(policy);
    form.setFieldsValue({
      branchPattern: policy.branchPattern,
      minApprovals: policy.minApprovals,
      requireBuildPass: policy.requireBuildPass,
      requireTestPass: policy.requireTestPass,
      enabled: policy.enabled,
    });
    setModalVisible(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingPolicy) {
        const updateData: UpdateBranchPolicyInput = {
          branchPattern: values.branchPattern,
          minApprovals: values.minApprovals,
          requireBuildPass: values.requireBuildPass,
          requireTestPass: values.requireTestPass,
          enabled: values.enabled,
        };
        await updateBranchPolicy(editingPolicy.id, updateData);
        message.success('策略已更新');
      } else {
        const createData: CreateBranchPolicyInput = {
          repoId: values.repoId || '',
          branchPattern: values.branchPattern,
          minApprovals: values.minApprovals,
          requireBuildPass: values.requireBuildPass,
          requireTestPass: values.requireTestPass,
          enabled: values.enabled,
        };
        await createBranchPolicy(createData);
        message.success('策略已创建');
      }
      setModalVisible(false);
      form.resetFields();
      loadPolicies();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(
          editingPolicy ? `更新策略失败：${error.message}` : `创建策略失败：${error.message}`
        );
      } else {
        message.error(editingPolicy ? '更新策略失败，请稍后重试' : '创建策略失败，请稍后重试');
      }
    }
  };

  const handleDelete = (policy: any) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分支策略 "${policy.branchPattern}" 吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteBranchPolicy(policy.id);
          message.success('策略已删除');
          loadPolicies();
        } catch (error: unknown) {
          if (error instanceof Error) {
            message.error(`删除策略失败：${error.message}`);
          } else {
            message.error('删除策略失败');
          }
        }
      },
    });
  };

  const handleToggleEnabled = async (policy: any, enabled: boolean) => {
    try {
      await updateBranchPolicy(policy.id, { enabled });
      message.success(enabled ? '策略已启用' : '策略已禁用');
      loadPolicies();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新状态失败：${error.message}`);
      } else {
        message.error('更新状态失败');
      }
    }
  };

  const columns: TableColumn<BranchPolicy>[] = [
    {
      key: 'branchPattern',
      title: '分支匹配',
      dataIndex: 'branchPattern',
      width: 200,
      sortable: true,
      filterable: true,
      render: (value: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text code strong>
            {String(value)}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            仓库: {record.repoId}
          </Text>
        </Space>
      ),
    },
    {
      key: 'minApprovals',
      title: '最少审批',
      dataIndex: 'minApprovals',
      width: 100,
      sortable: true,
      render: (value: unknown) => <Tag color="blue">{String(value)} 人</Tag>,
    },
    {
      key: 'requireBuildPass',
      title: '构建通过',
      dataIndex: 'requireBuildPass',
      width: 100,
      render: (value: unknown) => (
        <Tag color={value ? 'green' : 'default'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      key: 'requireTestPass',
      title: '测试通过',
      dataIndex: 'requireTestPass',
      width: 100,
      render: (value: unknown) => (
        <Tag color={value ? 'green' : 'default'}>{value ? '是' : '否'}</Tag>
      ),
    },
    {
      key: 'enabled',
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (_value: unknown, record: any) => (
        <Switch
          checked={record.enabled}
          onChange={(checked) => handleToggleEnabled(record, checked)}
          size="small"
        />
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'id',
      width: 160,
      sortable: true,
      render: () => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          -
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 120,
      render: (_: unknown, record: any) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
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

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <BranchesOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            分支策略
          </Title>
          <Text type="secondary">管理分支保护策略和合并规则</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadPolicies} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            创建策略
          </Button>
        </Space>
      </div>

      {/* Policy table */}
      <Table
        columns={columns}
        dataSource={policies}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingPolicy ? '编辑分支策略' : '创建分支策略'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleSave} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="分支匹配模式"
            name="branchPattern"
            rules={[{ required: true, message: '请输入分支匹配模式' }]}
          >
            <Input placeholder="例如：main, release/*, feature/*" />
          </Form.Item>
          {!editingPolicy && (
            <Form.Item label="仓库 ID" name="repoId">
              <Input placeholder="关联的仓库 ID (可选)" />
            </Form.Item>
          )}
          <Form.Item
            label="最少审批人数"
            name="minApprovals"
            rules={[{ required: true, message: '请输入最少审批人数' }]}
          >
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="requireBuildPass" valuePropName="checked">
            <Checkbox>要求构建通过</Checkbox>
          </Form.Item>
          <Form.Item name="requireTestPass" valuePropName="checked">
            <Checkbox>要求测试通过</Checkbox>
          </Form.Item>
          <Form.Item name="enabled" valuePropName="checked">
            <Checkbox>启用此策略</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BranchPolicyList;
