/**
 * 组件注册中心 (Component Registry)
 * 低代码平台自定义组件管理：注册 → 分类 → Props Schema → 默认配置
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Row,
  Col,
  message,
  Typography,
  Empty,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CodeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import {
  listComponents,
  createComponent,
  getComponent,
  type ComponentRegistry,
} from '@/api/lowcode';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CATEGORIES = [
  { value: 'basic', label: '基础' },
  { value: 'form', label: '表单' },
  { value: 'display', label: '展示' },
  { value: 'layout', label: '布局' },
  { value: 'data', label: '数据' },
  { value: 'custom', label: '自定义' },
];

const ComponentRegistryPage: React.FC = () => {
  const [components, setComponents] = useState<ComponentRegistry[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentRegistry | null>(null);
  const [form] = Form.useForm();

  const loadComponents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listComponents(category || undefined);
      setComponents(Array.isArray(data) ? data : []);
    } catch {
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  const handleCreate = async (values: any) => {
    try {
      const propsSchema = typeof values.propsSchema === 'string'
        ? JSON.parse(values.propsSchema)
        : values.propsSchema || {};
      const defaultConfig = typeof values.defaultConfig === 'string'
        ? JSON.parse(values.defaultConfig)
        : values.defaultConfig || {};
      await createComponent({
        name: values.name,
        displayName: values.displayName,
        category: values.category || 'custom',
        version: values.version || '1.0.0',
        propsSchema,
        defaultConfig,
        icon: values.icon,
      });
      message.success('组件注册成功');
      setModalOpen(false);
      form.resetFields();
      loadComponents();
    } catch {
      message.error('注册失败');
    }
  };

  const handleViewDetail = async (comp: ComponentRegistry) => {
    try {
      const data = await getComponent(comp.id);
      setSelectedComponent(data || comp);
      setDetailOpen(true);
    } catch {
      setSelectedComponent(comp);
      setDetailOpen(true);
    }
  };

  const columns = [
    { title: '组件名', dataIndex: 'name', key: 'name', width: 160, render: (v: string) => <Tag>{v}</Tag> },
    { title: '显示名', dataIndex: 'displayName', key: 'displayName' },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string) => <Tag color="blue">{CATEGORIES.find((c) => c.value === v)?.label || v}</Tag>,
    },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '内置',
      dataIndex: 'isBuiltin',
      key: 'isBuiltin',
      width: 70,
      render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '图标',
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (v: string) => v ? <span>{v}</span> : '-',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: ComponentRegistry) => (
        <Space>
          <Button size="small" type="link" icon={<CodeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
        <AppstoreOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        组件注册中心
      </Title>
      <Typography.Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        低代码平台自定义组件管理 · Props Schema · 默认配置
      </Typography.Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">组件总数</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>{components.length}</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">自定义组件</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>
              {components.filter((c) => !c.isBuiltin).length}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">内置组件</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
              {components.filter((c) => c.isBuiltin).length}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Typography.Text type="secondary">分类数</Typography.Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.purple[500] }}>
              {new Set(components.map((c) => c.category)).size}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="组件列表"
        extra={
          <Space>
            <Select
              style={{ width: 120 }}
              value={category}
              onChange={setCategory}
              allowClear
              placeholder="分类筛选"
            >
              {CATEGORIES.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} size="small" onClick={loadComponents} loading={loading}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              form.resetFields();
              setModalOpen(true);
            }}>注册组件</Button>
          </Space>
        }
      >
        {components.length === 0 ? (
          <Empty description="暂无已注册组件，请注册第一个组件" />
        ) : (
          <Table
            columns={columns}
            dataSource={components}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            size="small"
          />
        )}
      </Card>

      <Modal
        title="注册新组件"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="组件标识 (name)" rules={[{ required: true }]}>
            <Input placeholder="e.g. custom-input" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="e.g. 自定义输入框" />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="custom">
            <Select>
              {CATEGORIES.map((c) => (
                <Option key={c.value} value={c.value}>{c.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="version" label="版本" initialValue="1.0.0">
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="icon" label="图标名称">
            <Input placeholder="e.g. BlockOutlined" />
          </Form.Item>
          <Form.Item name="propsSchema" label="Props Schema (JSON)" rules={[{ required: true }]}>
            <TextArea
              rows={5}
              placeholder={`{"width":{"type":"string","default":"100%"},"disabled":{"type":"boolean","default":false}}`}
            />
          </Form.Item>
          <Form.Item name="defaultConfig" label="默认配置 (JSON)">
            <TextArea
              rows={3}
              placeholder='{"width":"100%","disabled":false}'
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="组件详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={600}
      >
        {selectedComponent && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="组件标识">{selectedComponent.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{selectedComponent.displayName}</Descriptions.Item>
            <Descriptions.Item label="分类">{CATEGORIES.find((c) => c.value === selectedComponent.category)?.label || selectedComponent.category}</Descriptions.Item>
            <Descriptions.Item label="版本">
              <Tag color="blue">{selectedComponent.version}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="图标">{selectedComponent.icon || '-'}</Descriptions.Item>
            <Descriptions.Item label="内置">
              <Tag color={selectedComponent.isBuiltin ? 'green' : 'default'}>
                {selectedComponent.isBuiltin ? '是' : '否'}
              </Tag>
            </Descriptions.Item>
            {selectedComponent.propsSchema && (
              <Descriptions.Item label="Props Schema">
                <pre style={{ margin: 0, fontSize: 12, maxHeight: 200, overflow: 'auto', background: themeVars.bgSecondary, padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(selectedComponent.propsSchema, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            {selectedComponent.defaultConfig && (
              <Descriptions.Item label="默认配置">
                <pre style={{ margin: 0, fontSize: 12, maxHeight: 150, overflow: 'auto', background: themeVars.bgSecondary, padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(selectedComponent.defaultConfig, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="注册时间">{new Date(selectedComponent.createdAt).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ComponentRegistryPage;