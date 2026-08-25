/**
 * CITypeDesigner — CI 类型设计器
 * 对接后端 /api/v1/ci-types 完整 CRUD
 * 含属性管理、版本快照、实例验证
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  Select,
  message,
  Popconfirm,
  Empty,
  Descriptions,
  Tabs,
} from 'antd';
import {
  BuildOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listCITypes,
  getCIType,
  createCIType,
  updateCIType,
  deleteCIType,
  getCITypeAttributes,
  setCITypeAttributes,
  getCITypeVersions,
  createCITypeVersion,
  rollbackCIType,
  type CIType,
  type CIAttribute,
  type CITypeVersion,
} from '@/api/ci-types';
import { colors } from '@/tokens';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  draft: 'orange',
  archived: 'default',
  deprecated: 'red',
};

const CITypeDesignerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState<CIType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<CIType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CIType | null>(null);
  const [attributes, setAttributes] = useState<CIAttribute[]>([]);
  const [versions, setVersions] = useState<CITypeVersion[]>([]);
  const [detailTab, setDetailTab] = useState('attributes');
  const [attrModalOpen, setAttrModalOpen] = useState(false);
  const [attrForm] = Form.useForm();
  const [form] = Form.useForm();

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCITypes();
      const body = res.data as unknown;
      const items = Array.isArray(body) ? body : (body as { data?: CIType[] })?.data ?? [];
      setTypes(items);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载 CI 类型失败');
      setTypes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const handleCreate = () => {
    setEditingType(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = async (record: CIType) => {
    setEditingType(record);
    try {
      const res = await getCIType(record.id);
      const detail = res.data as CIType;
      form.setFieldsValue({
        name: detail.name,
        displayName: detail.displayName,
        description: detail.description,
        icon: detail.icon,
        category: detail.category,
        enabled: detail.enabled,
      });
    } catch {
      form.setFieldsValue({
        name: record.name,
        displayName: record.displayName,
        description: record.description,
        enabled: record.enabled,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingType) {
        await updateCIType(editingType.id, values);
        message.success('更新 CI 类型成功');
      } else {
        await createCIType(values);
        message.success('创建 CI 类型成功');
      }
      setModalOpen(false);
      loadTypes();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCIType(id);
      message.success('删除成功');
      loadTypes();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleViewDetail = async (record: CIType) => {
    setSelectedType(record);
    setDetailOpen(true);
    setDetailTab('attributes');
    loadAttributes(record.id);
    loadVersions(record.id);
  };

  const loadAttributes = async (typeId: string) => {
    try {
      const res = await getCITypeAttributes(typeId);
      const body = res.data as unknown;
      setAttributes(Array.isArray(body) ? body : (body as { data?: CIAttribute[] })?.data ?? []);
    } catch {
      message.error('加载属性列表失败');
      setAttributes([]);
    }
  };

  const loadVersions = async (typeId: string) => {
    try {
      const res = await getCITypeVersions(typeId);
      const body = res.data as unknown;
      setVersions(Array.isArray(body) ? body : (body as { data?: CITypeVersion[] })?.data ?? []);
    } catch {
      message.error('加载版本列表失败');
      setVersions([]);
    }
  };

  const handleSaveAttributes = async () => {
    if (!selectedType) return;
    try {
      const values = await attrForm.validateFields();
      await setCITypeAttributes(selectedType.id, values.attributes || []);
      message.success('保存属性成功');
      setAttrModalOpen(false);
      loadAttributes(selectedType.id);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    }
  };

  const handleCreateVersion = async () => {
    if (!selectedType) return;
    try {
      await createCITypeVersion(selectedType.id);
      message.success('创建版本快照成功');
      loadVersions(selectedType.id);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建版本快照失败');
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!selectedType) return;
    try {
      await rollbackCIType(selectedType.id, versionId);
      message.success('回滚成功');
      loadTypes();
      loadAttributes(selectedType.id);
      loadVersions(selectedType.id);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '回滚失败');
    }
  };

  const columns: ColumnsType<CIType> = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        key: 'name',
        width: '15%',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: '显示名称',
        dataIndex: 'displayName',
        key: 'displayName',
        width: '15%',
        render: (val: string | null) => val || '-',
      },
      {
        title: '分类',
        dataIndex: 'category',
        key: 'category',
        width: '12%',
        render: (val: string | null) => (val ? <Tag>{val}</Tag> : '-'),
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: '10%',
        render: (status: string) => (
          <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>
        ),
      },
      {
        title: '版本',
        dataIndex: 'version',
        key: 'version',
        width: '8%',
      },
      {
        title: '启用',
        dataIndex: 'enabled',
        key: 'enabled',
        width: '8%',
        render: (enabled: boolean) =>
          enabled ? <Tag color="green">是</Tag> : <Tag color="default">否</Tag>,
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: '16%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: '16%',
        render: (_: unknown, record: CIType) => (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确认删除此 CI 类型？"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    []
  );

  const attrColumns: ColumnsType<CIAttribute> = useMemo(
    () => [
      { title: '属性键', dataIndex: 'attrKey', key: 'attrKey', width: '18%' },
      { title: '名称', dataIndex: 'name', key: 'name', width: '18%' },
      {
        title: '类型',
        dataIndex: 'attrType',
        key: 'attrType',
        width: '12%',
        render: (val: string) => <Tag>{val}</Tag>,
      },
      {
        title: '必填',
        dataIndex: 'required',
        key: 'required',
        width: '8%',
        render: (val: boolean) =>
          val ? <CheckCircleOutlined style={{ color: colors.error[500] }} /> : '-',
      },
      {
        title: '默认值',
        dataIndex: 'defaultValue',
        key: 'defaultValue',
        width: '12%',
        render: (val: string | null) => val || '-',
      },
      { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: '8%' },
    ],
    []
  );

  const versionColumns: ColumnsType<CITypeVersion> = useMemo(
    () => [
      { title: '版本号', dataIndex: 'version', key: 'version', width: '20%' },
      {
        title: '变更摘要',
        dataIndex: 'changeSummary',
        key: 'changeSummary',
        width: '40%',
        render: (val: string | null) => val || '-',
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: '25%',
        render: (val: string) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
      },
      {
        title: '操作',
        key: 'action',
        width: '15%',
        render: (_: unknown, record: CITypeVersion) => (
          <Popconfirm
            title="确认回滚到此版本？此操作将覆盖当前属性配置"
            onConfirm={() => handleRollback(record.id)}
            okText="确认回滚"
            cancelText="取消"
          >
            <Button type="link" size="small" icon={<HistoryOutlined />}>
              回滚
            </Button>
          </Popconfirm>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <BuildOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        CI 类型设计器
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        可视化设计 CI 类型属性与关系，管理版本快照和实例验证
      </Text>

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建 CI 类型
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadTypes} loading={loading}>
            刷新
          </Button>
        </Space>
        <Table<CIType>
          columns={columns}
          dataSource={types}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 项`,
          }}
          locale={{ emptyText: <Empty description="暂无 CI 类型数据" /> }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingType ? '编辑 CI 类型' : '新建 CI 类型'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
        okText={editingType ? '保存' : '创建'}
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
          <Form.Item
            name="name"
            label="名称"
            rules={[
              { required: true, message: '请输入 CI 类型名称' },
              {
                pattern: /^[a-zA-Z0-9_-]+$/,
                message: '名称只能包含英文字母、数字、下划线或连字符',
              },
              { min: 2, message: '名称至少 2 个字符' },
              { max: 50, message: '名称不超过 50 个字符' },
            ]}
          >
            <Input placeholder="如：server, database, app" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input placeholder="如：服务器, 数据库, 应用" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="类型描述（可选）" />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input placeholder="图标名称（可选）" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Select
              placeholder="选择分类"
              allowClear
              options={[
                { label: '基础设施', value: 'infrastructure' },
                { label: '应用服务', value: 'application' },
                { label: '网络', value: 'network' },
                { label: '安全', value: 'security' },
                { label: '其他', value: 'other' },
              ]}
            />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Modal */}
      <Modal
        title={selectedType ? selectedType.name : 'CI 类型详情'}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {selectedType && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="名称">{selectedType.name}</Descriptions.Item>
              <Descriptions.Item label="显示名称">
                {selectedType.displayName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="分类">{selectedType.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedType.version}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLORS[selectedType.status] || 'default'}>
                  {selectedType.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="启用">{selectedType.enabled ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedType.description || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Tabs
              activeKey={detailTab}
              onChange={setDetailTab}
              items={[
                {
                  key: 'attributes',
                  label: '属性',
                  children: (
                    <div>
                      <Space style={{ marginBottom: 12 }}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            attrForm.resetFields();
                            setAttrModalOpen(true);
                          }}
                        >
                          管理属性
                        </Button>
                      </Space>
                      <Table<CIAttribute>
                        columns={attrColumns}
                        dataSource={attributes}
                        rowKey="id"
                        pagination={false}
                        locale={{ emptyText: <Empty description="暂无属性定义" /> }}
                      />
                    </div>
                  ),
                },
                {
                  key: 'versions',
                  label: '版本快照',
                  children: (
                    <div>
                      <Space style={{ marginBottom: 12 }}>
                        <Button
                          type="primary"
                          size="small"
                          icon={<HistoryOutlined />}
                          onClick={handleCreateVersion}
                        >
                          创建版本快照
                        </Button>
                      </Space>
                      <Table<CITypeVersion>
                        columns={versionColumns}
                        dataSource={versions}
                        rowKey="id"
                        pagination={false}
                        locale={{ emptyText: <Empty description="暂无版本快照" /> }}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
      </Modal>

      {/* 属性管理 Modal */}
      <Modal
        title="管理属性"
        open={attrModalOpen}
        onOk={handleSaveAttributes}
        onCancel={() => setAttrModalOpen(false)}
        destroyOnClose
        width={700}
      >
        <Form form={attrForm} layout="vertical" initialValues={{ attributes: [] }}>
          <Form.List name="attributes">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 8, borderRadius: 8 }}
                    extra={
                      <Button type="link" danger onClick={() => remove(name)}>
                        删除
                      </Button>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Form.Item
                          {...restField}
                          name={[name, 'attrKey']}
                          rules={[{ required: true, message: '必填' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="属性键" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'displayName']} style={{ marginBottom: 0 }}>
                          <Input placeholder="显示名称" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'attrType']}
                          initialValue="string"
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            style={{ width: 120 }}
                            options={[
                              { label: '字符串', value: 'string' },
                              { label: '整数', value: 'integer' },
                              { label: '布尔', value: 'boolean' },
                              { label: '枚举', value: 'enum' },
                              { label: '日期', value: 'date' },
                              { label: '引用', value: 'reference' },
                            ]}
                          />
                        </Form.Item>
                      </Space>
                      <Space>
                        <Form.Item
                          {...restField}
                          name={[name, 'required']}
                          valuePropName="checked"
                          style={{ marginBottom: 0 }}
                        >
                          <Switch checkedChildren="必填" unCheckedChildren="可选" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'defaultValue']} style={{ marginBottom: 0 }}>
                          <Input placeholder="默认值" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'sortOrder']} style={{ marginBottom: 0 }}>
                          <Input type="number" placeholder="排序" style={{ width: 80 }} />
                        </Form.Item>
                      </Space>
                    </Space>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加属性
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default CITypeDesignerPage;