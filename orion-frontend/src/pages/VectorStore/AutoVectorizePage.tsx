/**
 * Auto-Vectorization Configuration Page
 * Configure automatic vectorization rules for uploaded documents
 */
import _React, { useState, useEffect } from 'react';
import { InputNumber,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  message,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ThunderboltOutlined,
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface VectorizeRule {
  id: string;
  name: string;
  source_type: 'upload' | 'git' | 'api' | 'database';
  file_types: string[];
  chunk_size: number;
  chunk_overlap: number;
  embedding_model: string;
  target_collection: string;
  enabled: boolean;
  last_run: string | null;
  processed_count: number;
}

const sourceTypeOptions = [
  { label: '文件上传', value: 'upload' },
  { label: 'Git 仓库', value: 'git' },
  { label: 'API 推送', value: 'api' },
  { label: '数据库同步', value: 'database' },
];

const fileTypeOptions = [
  { label: 'Markdown', value: 'md' },
  { label: 'PDF', value: 'pdf' },
  { label: 'Word', value: 'docx' },
  { label: '纯文本', value: 'txt' },
  { label: 'HTML', value: 'html' },
  { label: '代码', value: 'code' },
  { label: 'JSON', value: 'json' },
];

const embeddingModelOptions = [
  { label: 'OpenAI text-embedding-3-small', value: 'text-embedding-3-small' },
  { label: 'OpenAI text-embedding-3-large', value: 'text-embedding-3-large' },
  { label: 'BGE-M3 (本地)', value: 'bge-m3' },
  { label: 'GTE-Qwen2 (本地)', value: 'gte-qwen2' },
];

export default function AutoVectorizePage() {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<VectorizeRule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchRules = async () => {
    setLoading(true);
    try {
      // TODO: integrate with knowledge/vectorize API
      setRules([]);
    } catch {
      message.error('获取规则失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const handleCreate = async (_values: any) => {
    try {
      // TODO: integrate with knowledge/vectorize API
      message.success('规则创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchRules();
    } catch {
      message.error('创建失败');
    }
  };

  const handleToggle = async (_id: string, enabled: boolean) => {
    try {
      // TODO: integrate with knowledge/vectorize API
      message.success(enabled ? '已启用' : '已禁用');
      fetchRules();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: '数据来源',
      dataIndex: 'source_type',
      key: 'source_type',
      render: (v: string) => {
        const labels: Record<string, string> = {
          upload: '文件上传', git: 'Git 仓库', api: 'API 推送', database: '数据库同步',
        };
        return <Tag>{labels[v] || v}</Tag>;
      },
    },
    {
      title: '文件类型',
      dataIndex: 'file_types',
      key: 'file_types',
      render: (v: string[]) => v?.map(t => <Tag key={t} color="blue">{t}</Tag>) ?? '-',
    },
    {
      title: '分块大小',
      dataIndex: 'chunk_size',
      key: 'chunk_size',
      render: (v: number) => `${v} tokens`,
    },
    {
      title: 'Embedding 模型',
      dataIndex: 'embedding_model',
      key: 'embedding_model',
      ellipsis: true,
    },
    {
      title: '目标集合',
      dataIndex: 'target_collection',
      key: 'target_collection',
    },
    {
      title: '已处理',
      dataIndex: 'processed_count',
      key: 'processed_count',
      render: (v: number) => v?.toLocaleString() ?? '0',
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v: boolean, record: VectorizeRule) => (
        <Switch checked={v} onChange={(checked) => handleToggle(record.id, checked)} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button size="small" icon={<SettingOutlined />}>编辑</Button>
          <Button size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        自动向量化
      </Title>

      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃规则"
              value={rules.filter(r => r.enabled).length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已处理文档"
              value={rules.reduce((sum, r) => sum + (r.processed_count || 0), 0)}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={0}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="规则总数"
              value={rules.length}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="向量化规则"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchRules}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              新建规则
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={rules}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="新建向量化规则"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{
            chunk_size: 512,
            chunk_overlap: 50,
            embedding_model: 'text-embedding-3-small',
            file_types: ['md', 'pdf', 'txt'],
          }}
        >
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如：产品文档自动向量化" />
          </Form.Item>
          <Form.Item name="source_type" label="数据来源" rules={[{ required: true }]}>
            <Select options={sourceTypeOptions} />
          </Form.Item>
          <Form.Item name="file_types" label="文件类型" rules={[{ required: true }]}>
            <Select mode="multiple" options={fileTypeOptions} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="chunk_size" label="分块大小 (tokens)">
                <InputNumber min={64} max={4096} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="chunk_overlap" label="分块重叠 (tokens)">
                <InputNumber min={0} max={512} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="embedding_model" label="Embedding 模型" rules={[{ required: true }]}>
            <Select options={embeddingModelOptions} />
          </Form.Item>
          <Form.Item name="target_collection" label="目标向量集合" rules={[{ required: true }]}>
            <Select placeholder="选择或创建向量集合" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
