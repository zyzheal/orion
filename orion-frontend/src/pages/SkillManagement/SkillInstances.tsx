/**
 * Skill Instance Management Page
 * List, create, edit, delete instances for a specific skill.
 *
 * Features:
 * - Table of instances with status, config, tenant/project scope
 * - Create/Edit/Delete with modal forms
 * - Apple/Feishu design style
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  message,
  Row,
  Col,
  Statistic,
  Switch,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import {
  getSkillInstances,
  createSkillInstance,
  updateSkillInstance,
  deleteSkillInstance,
  getSkill,
  type SkillInstance,
  type CreateInstanceInput,
  type UpdateInstanceInput,
  type SkillPackage,
} from '@/api/skills';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SkillInstances: React.FC = () => {
  const { id: skillId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState<SkillInstance[]>([]);
  const [skill, setSkill] = useState<SkillPackage | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingInstance, setEditingInstance] = useState<SkillInstance | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    if (!skillId) return;
    setLoading(true);
    try {
      const [instRes, skillRes] = await Promise.all([
        getSkillInstances(skillId),
        getSkill(skillId),
      ]);
      setInstances(Array.isArray(instRes.data.data) ? instRes.data.data : []);
      const skillData = (skillRes as { data?: { data?: unknown } })?.data?.data;
      setSkill(skillData || null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载失败：${error.message}`);
      } else {
        message.error('加载失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [skillId]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingInstance(null);
    form.resetFields();
    form.setFieldsValue({ isDefault: false, config: '{}' });
    setModalVisible(true);
  };

  const handleOpenEdit = (record: SkillInstance) => {
    setModalMode('edit');
    setEditingInstance(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description || '',
      projectId: record.projectId || '',
      config: JSON.stringify(record.config, null, 2),
      bindings: JSON.stringify(record.bindings, null, 2),
      isDefault: record.isDefault,
      version: record.version || '',
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!skillId) return;

      const configObj = (() => {
        try {
          return values.config ? JSON.parse(values.config) : {};
        } catch {
          message.error('配置 JSON 格式不正确');
          return null;
        }
      })();
      if (configObj === null) return;

      const bindingsObj = (() => {
        try {
          return values.bindings ? JSON.parse(values.bindings) : {};
        } catch {
          return {};
        }
      })();

      if (modalMode === 'create') {
        const payload: CreateInstanceInput = {
          name: values.name,
          description: values.description || undefined,
          projectId: values.projectId || undefined,
          config: configObj,
          bindings: bindingsObj,
          isDefault: values.isDefault || false,
          version: values.version || undefined,
        };
        await createSkillInstance(skillId, payload);
        message.success('实例创建成功');
      } else if (editingInstance) {
        const payload: UpdateInstanceInput = {
          name: values.name,
          description: values.description || undefined,
          projectId: values.projectId || undefined,
          config: configObj,
          bindings: bindingsObj,
          isDefault: values.isDefault,
        };
        await updateSkillInstance(skillId, editingInstance.id, payload);
        message.success('实例更新成功');
      }

      setModalVisible(false);
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(error instanceof Error ? error.message : '操作失败');
      }
    }
  };

  const handleDelete = (record: SkillInstance) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除实例 "${record.name}" 吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!skillId) return;
        setDeletingId(record.id);
        try {
          await deleteSkillInstance(skillId, record.id);
          message.success('实例已删除');
          loadData();
        } catch (error: unknown) {
          message.error(error instanceof Error ? error.message : '删除失败');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const filteredInstances = useMemo(() => {
    return instances;
  }, [instances]);

  const columns: TableColumn<SkillInstance>[] = [
    {
      key: 'name',
      title: '实例名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(v)}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: spacing[2] }}>
              {record.description.slice(0, 50)}
            </Text>
          )}
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => {
        const status = String(v);
        const badgeStatus: 'running' | 'pending' | 'success' | 'failed' | 'warning' | 'cancelled' | 'unknown' =
          status === 'active' ? 'success' : status === 'inactive' ? 'cancelled' : status === 'error' ? 'failed' : 'pending';
        return <StatusBadge status={badgeStatus} size="small" />;
      },
    },
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 100,
      render: (v: unknown) => (v ? <Tag>v{String(v)}</Tag> : <Text type="secondary">默认</Text>),
    },
    {
      key: 'projectId',
      title: '项目',
      dataIndex: 'projectId',
      width: 140,
      render: (v: unknown) =>
        v ? <Tag color="blue">{String(v)}</Tag> : <Text type="secondary">全部项目</Text>,
    },
    {
      key: 'isDefault',
      title: '默认实例',
      dataIndex: 'isDefault',
      width: 100,
      render: (v: unknown) =>
        v ? <Tag color="green">默认</Tag> : <Text type="secondary">-</Text>,
    },
    {
      key: 'tenantId',
      title: '租户',
      dataIndex: 'tenantId',
      width: 120,
      render: (v: unknown) => <Text code style={{ fontSize: spacing[2] }}>{String(v)}</Text>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[2] }}>
          {new Date(String(v)).toLocaleString('zh-CN')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      render: (_: unknown, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            loading={deletingId === record.id}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Space style={{ marginBottom: 8 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/skills/my')}
            >
              返回
            </Button>
          </Space>
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            实例管理 {skill && <Text type="secondary">- {skill.name}</Text>}
          </Title>
          <Text type="secondary">管理技能的运行实例，支持多租户和项目级别隔离</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建实例
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="实例总数" value={instances.length} suffix="个" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="活跃实例"
              value={instances.filter((i) => i.status === 'active').length}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="默认实例"
              value={instances.filter((i) => i.isDefault).length}
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* Instance Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredInstances}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={modalMode === 'create' ? '创建实例' : '编辑实例'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={700}
        okText={modalMode === 'create' ? '创建' : '保存'}
      >
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item
            name="name"
            label="实例名称"
            rules={[{ required: true, message: '请输入实例名称' }]}
          >
            <Input placeholder="例如: 生产环境实例" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="描述该实例的用途..." />
          </Form.Item>

          <Form.Item name="projectId" label="项目范围">
            <Input placeholder="留空表示全部项目" />
          </Form.Item>

          <Form.Item name="version" label="指定版本">
            <Input placeholder="留空使用最新版本" />
          </Form.Item>

          <Form.Item name="config" label="实例配置 (JSON)">
            <TextArea rows={6} placeholder='{"key": "value"}' style={{ fontFamily: 'monospace' }} />
          </Form.Item>

          <Form.Item name="bindings" label="事件绑定 (JSON)">
            <TextArea rows={4} placeholder='{"event": "handler"}' style={{ fontFamily: 'monospace' }} />
          </Form.Item>

          <Form.Item name="isDefault" label="设为默认实例" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SkillInstances;
