/**
 * Index Management Page
 * Configure and manage vector index parameters (HNSW, IVF, etc.)
 */
import _React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  Typography,
  message,
  Tooltip,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';

const { Title } = Typography;

interface VectorIndex {
  id: string;
  collection_id: string;
  collection_name: string;
  index_type: 'hnsw' | 'ivf_flat' | 'ivf_pq' | 'flat';
  metric: 'cosine' | 'l2' | 'ip';
  dimension: number;
  parameters: Record<string, unknown>;
  status: 'building' | 'ready' | 'error';
  vector_count: number;
  created_at: string;
}

const indexTypeOptions = [
  { label: 'HNSW (推荐)', value: 'hnsw', description: '高召回率，适合中小规模数据集' },
  { label: 'IVF Flat', value: 'ivf_flat', description: '平衡性能与精度，适合大规模数据集' },
  { label: 'IVF PQ', value: 'ivf_pq', description: '内存优化，适合超大规模数据集' },
  { label: 'Flat (暴力搜索)', value: 'flat', description: '100% 召回率，适合小数据集' },
];

const metricOptions = [
  { label: '余弦相似度 (Cosine)', value: 'cosine' },
  { label: '欧氏距离 (L2)', value: 'l2' },
  { label: '内积 (Inner Product)', value: 'ip' },
];

export default function IndexManagementPage() {
  const [loading, setLoading] = useState(false);
  const [indexes, setIndexes] = useState<VectorIndex[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const indexType = Form.useWatch('index_type', form);

  const fetchIndexes = async () => {
    setLoading(true);
    try {
      // TODO: integrate with vector-store API
      setIndexes([]);
    } catch {
      message.error('获取索引列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIndexes(); }, []);

  const handleCreate = async (_values: any) => {
    try {
      // TODO: integrate with vector-store API
      message.success('索引创建成功');
      setModalVisible(false);
      form.resetFields();
      fetchIndexes();
    } catch {
      message.error('创建失败');
    }
  };

  const columns = [
    {
      title: '集合',
      dataIndex: 'collection_name',
      key: 'collection_name',
    },
    {
      title: '索引类型',
      dataIndex: 'index_type',
      key: 'index_type',
      render: (v: string) => <Tag color="blue">{v.toUpperCase()}</Tag>,
    },
    {
      title: '距离度量',
      dataIndex: 'metric',
      key: 'metric',
      render: (v: string) => {
        const labels: Record<string, string> = { cosine: '余弦', l2: 'L2', ip: '内积' };
        return labels[v] || v;
      },
    },
    {
      title: '维度',
      dataIndex: 'dimension',
      key: 'dimension',
    },
    {
      title: '向量数',
      dataIndex: 'vector_count',
      key: 'vector_count',
      render: (v: number) => v?.toLocaleString() ?? '0',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const cfg: Record<string, { color: string; label: string }> = {
          building: { color: 'processing', label: '构建中' },
          ready: { color: 'success', label: '就绪' },
          error: { color: 'error', label: '错误' },
        };
        const c = cfg[v] || cfg.ready;
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '参数',
      key: 'parameters',
      render: (_: any, record: VectorIndex) => (
        <Tooltip title={<pre>{JSON.stringify(record.parameters, null, 2)}</pre>}>
          <Button size="small" icon={<InfoCircleOutlined />}>查看</Button>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button size="small">重建</Button>
          <Button size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        索引管理
      </Title>

      <Card
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchIndexes}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              创建索引
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={indexes}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="创建向量索引"
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ index_type: 'hnsw', metric: 'cosine', dimension: 1536 }}
        >
          <Form.Item name="collection_id" label="集合" rules={[{ required: true }]}>
            <Select placeholder="选择向量集合" />
          </Form.Item>
          <Form.Item name="index_type" label="索引类型" rules={[{ required: true }]}>
            <Select options={indexTypeOptions} />
          </Form.Item>
          <Form.Item name="metric" label="距离度量" rules={[{ required: true }]}>
            <Select options={metricOptions} />
          </Form.Item>
          <Form.Item name="dimension" label="向量维度" rules={[{ required: true }]}>
            <InputNumber min={1} max={65536} style={{ width: '100%' }} />
          </Form.Item>

          {indexType === 'hnsw' && (
            <>
              <Form.Item name={['parameters', 'm']} label="M (连接数)" initialValue={16}>
                <InputNumber min={4} max={64} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name={['parameters', 'ef_construction']} label="ef_construction" initialValue={200}>
                <InputNumber min={16} max={1000} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name={['parameters', 'ef_search']} label="ef_search" initialValue={64}>
                <InputNumber min={16} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}

          {indexType === 'ivf_flat' && (
            <>
              <Form.Item name={['parameters', 'nlist']} label="nlist (聚类中心数)" initialValue={1024}>
                <InputNumber min={1} max={65536} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name={['parameters', 'nprobe']} label="nprobe (搜索聚类数)" initialValue={32}>
                <InputNumber min={1} max={4096} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}
