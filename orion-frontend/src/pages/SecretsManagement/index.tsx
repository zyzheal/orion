/**
 * Secrets Management Page
 * Create, view, edit, and delete pipeline secrets.
 *
 * Security: Secret values are NEVER displayed in any form — only '***' masked.
 * Uses Ant Design's Password input for secret value fields.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Modal, Form, Input, Select, message, Tag, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  type Secret,
  type SecretScope,
  type CreateSecretInput,
  type UpdateSecretInput,
} from '@/api/secrets';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { spacing } from '@/tokens';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Password } = Input;

// Masked placeholder shown instead of actual secret values
const MASKED_VALUE = '***';

// Scope label mapping
const scopeLabelMap: Record<SecretScope, string> = {
  org: '组织',
  environment: '环境',
  project: '项目',
};

// Scope tag colors
const scopeColorMap: Record<SecretScope, string> = {
  org: 'purple',
  environment: 'blue',
  project: 'green',
};

const SecretsManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});

  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [confirmEditVisible, setConfirmEditVisible] = useState(false);

  // Form instances
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // Tenant ID — in a real app this comes from auth store or context
  const tenantId = 'default-tenant';

  // ---- Data Loading ----

  const loadSecrets = async () => {
    setLoading(true);
    try {
      const response = await getSecrets(tenantId);
      const data = response.data;
      setSecrets(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      message.error(`加载 Secret 列表失败: ${(error as Error).message}`);
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, []);

  // ---- Filtering ----

  const filteredSecrets = useMemo(() => {
    return secrets.filter((secret) => {
      // Name search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !secret.name.toLowerCase().includes(query) &&
          !(secret.description && secret.description.toLowerCase().includes(query))
        ) {
          return false;
        }
      }

      // Scope filter
      const scopeFilter = filters.scope;
      if (scopeFilter && scopeFilter !== 'all' && secret.scope !== scopeFilter) {
        return false;
      }

      return true;
    });
  }, [searchQuery, filters, secrets]);

  // ---- Create ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);

      const payload: CreateSecretInput = {
        name: values.name.trim(),
        value: values.value,
        scope: values.scope as SecretScope,
        description: values.description?.trim() || undefined,
      };

      await createSecret(tenantId, payload);
      message.success('Secret 创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await loadSecrets();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Edit ----

  const openEdit = (record: Secret) => {
    setEditingSecret(record);
    editForm.resetFields();
    editForm.setFieldsValue({
      description: record.description || '',
    });
    // Show confirmation before allowing value edit
    setConfirmEditVisible(true);
  };

  const handleEditConfirm = () => {
    setConfirmEditVisible(false);
    setEditModalVisible(true);
  };

  const handleEdit = async () => {
    if (!editingSecret) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);

      // Only update if value is provided
      const payload: UpdateSecretInput = { value: '' };
      if (values.value) {
        payload.value = values.value;
      }
      if (values.description !== undefined) {
        payload.description = values.description.trim() || undefined;
      }

      // Require at least one field
      if (!payload.value && payload.description === undefined) {
        message.warning('请至少输入新的 Secret 值或描述');
        return;
      }

      await updateSecret(tenantId, editingSecret.id, payload);
      message.success('Secret 更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setEditingSecret(null);
      await loadSecrets();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Delete ----

  const handleDelete = async (id: string) => {
    try {
      await deleteSecret(tenantId, id);
      message.success('Secret 已删除');
      await loadSecrets();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  // ---- Filter Definitions ----

  const filterDefs: FilterDefinition[] = [
    {
      key: 'scope',
      label: '作用域',
      options: [
        { label: '全部', value: 'all' },
        { label: '组织 (org)', value: 'org' },
        { label: '环境 (environment)', value: 'environment' },
        { label: '项目 (project)', value: 'project' },
      ],
    },
  ];

  // ---- Column Definitions ----

  const columns: TableColumn<Secret>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 250,
      sortable: true,
      filterable: true,
      render: (value: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(value)}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      key: 'scope',
      title: '作用域',
      dataIndex: 'scope',
      width: 160,
      render: (value: unknown) => {
        const scope = value as SecretScope;
        return (
          <Tag color={scopeColorMap[scope] || 'default'}>
            {scopeLabelMap[scope] || scope}
          </Tag>
        );
      },
    },
    {
      key: 'value',
      title: 'Secret 值',
      width: 120,
      render: () => (
        <Text type="secondary" style={{ fontFamily: 'monospace' }}>
          {MASKED_VALUE}
        </Text>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'createdBy',
      title: '创建人',
      dataIndex: 'createdBy',
      width: 140,
      render: (value: unknown) => (
        <Text type="secondary">{value ? String(value) : '-'}</Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除 Secret "${record.name}" 吗？此操作不可撤销。`}
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <KeyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Secrets 管理
          </Title>
          <Text type="secondary">
            管理 Pipeline 密钥，所有 Secret 值使用 AES-256-GCM 加密存储，不会在任何界面显示
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadSecrets} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateModalVisible(true);
            }}
          >
            创建 Secret
          </Button>
        </Space>
      </div>

      {/* Search and Filter Bar */}
      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索 Secret 名称、描述..."
        />
      </div>

      {/* Secrets Table */}
      <Table
        columns={columns}
        dataSource={filteredSecrets}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Create Secret Modal */}
      <Modal
        title="创建 Secret"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" autoComplete="off">
          <Form.Item
            name="name"
            label="名称"
            rules={[
              { required: true, message: '请输入 Secret 名称' },
              {
                pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
                message: '名称只能包含字母、数字和下划线，且不能以数字开头',
              },
            ]}
            tooltip="用于 Pipeline 中引用，格式: \${secrets.NAME}"
          >
            <Input placeholder="如: DB_PASSWORD" maxLength={255} />
          </Form.Item>

          <Form.Item
            name="value"
            label="Secret 值"
            rules={[{ required: true, message: '请输入 Secret 值' }]}
          >
            <Password
              placeholder="输入密钥值（将加密存储）"
              autoComplete="new-password"
              visibilityToggle={false}
            />
          </Form.Item>

          <Form.Item
            name="scope"
            label="作用域"
            rules={[{ required: true, message: '请选择作用域' }]}
            initialValue="project"
          >
            <Select
              options={[
                { label: '项目 (project) — 仅当前项目可用', value: 'project' },
                { label: '环境 (environment) — 指定环境可用', value: 'environment' },
                { label: '组织 (org) — 整个组织可用', value: 'org' },
              ]}
              placeholder="选择作用域"
            />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选，描述此 Secret 的用途..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Confirmation Modal */}
      <Modal
        title="确认编辑"
        open={confirmEditVisible}
        onCancel={() => {
          setConfirmEditVisible(false);
          setEditingSecret(null);
        }}
        onOk={handleEditConfirm}
        okText="继续编辑"
        cancelText="取消"
      >
        {editingSecret && (
          <div>
            <Text>
              即将编辑 Secret: <Text strong>{editingSecret.name}</Text>
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12, marginTop: spacing.sm, display: 'block' }}>
              注意：更新 Secret 值后，所有引用该 Secret 的 Pipeline 在下一次运行时将使用新的值。
              旧值将被永久删除。
            </Text>
          </div>
        )}
      </Modal>

      {/* Edit Secret Modal */}
      <Modal
        title={`编辑 Secret: ${editingSecret?.name || ''}`}
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingSecret(null);
          editForm.resetFields();
        }}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={560}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" autoComplete="off">
          <Form.Item
            name="value"
            label="新 Secret 值"
            extra="留空则不更新 Secret 值"
          >
            <Password
              placeholder="输入新的密钥值（将加密存储）"
              autoComplete="new-password"
              visibilityToggle={false}
            />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="描述此 Secret 的用途..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SecretsManagement;
