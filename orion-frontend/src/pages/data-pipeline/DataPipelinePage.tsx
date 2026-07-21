/**
 * Data Pipeline Page (legacy)
 * Phase 4 - ETL pipeline management, data flow monitoring, and transformation rules
 *
 * Note: This is the legacy page. The route now points to PipelineManagementPage.
 * Kept for backward compatibility.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Drawer,
} from 'antd';
import {
  DatabaseOutlined,
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  ApiOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import {
  listDataPipelines,
  createDataPipeline,
  runDataPipeline,
  getDataPipelineLineage,
  type DataPipeline,
} from '@/api/data-pipeline';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

// Status configuration
const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: 'processing', label: '运行中' },
  paused: { color: 'warning', label: '已暂停' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  pending: { color: 'default', label: '等待中' },
};

const DataPipelinePage: React.FC = () => {
  const [pipelines, setPipelines] = useState<DataPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [lineageDrawerOpen, setLineageDrawerOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<DataPipeline | null>(null);
  const [lineageData, setLineageData] = useState<string>('');
  const [lineageLoading, setLineageLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await listDataPipelines();
      const data = Array.isArray(result.data) ? result.data : [];
      setPipelines(data);
    } catch (error: unknown) {
      message.error(`加载数据管道失败: ${(error as Error).message}`);
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await createDataPipeline({
        name: values.name as string,
        description: (values.description as string) || '',
        sourceTable: values.sourceTable as string,
        targetTable: values.targetTable as string,
        transformationScript: values.transformationScript as string,
        schedule: values.schedule as string,
      });
      message.success('数据管道创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建数据管道失败: ${(error as Error).message}`);
    }
  };

  const handleExecute = async (id: string) => {
    setActionLoading(id);
    try {
      await runDataPipeline(id);
      message.success('管道执行成功');
      loadData();
    } catch (error: unknown) {
      message.error(`执行管道失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewLineage = async (pipeline: DataPipeline) => {
    setSelectedPipeline(pipeline);
    setLineageDrawerOpen(true);
    setLineageLoading(true);
    try {
      const result = await getDataPipelineLineage(pipeline.id);
      setLineageData(JSON.stringify(result.lineage || {}, null, 2));
    } catch (error: unknown) {
      message.error(`加载数据血缘失败: ${(error as Error).message}`);
      setLineageData('加载失败');
    } finally {
      setLineageLoading(false);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: pipelines.length,
    running: pipelines.filter((p) => p.status === 'running').length,
    paused: pipelines.filter((p) => p.status === 'paused').length,
    failed: pipelines.filter((p) => p.status === 'failed').length,
  }), [pipelines]);

  // Pipeline table columns
  const pipelineColumns = [
    {
      title: '管道名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string, record: DataPipeline) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: record.description }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '源表',
      dataIndex: 'sourceTable',
      key: 'sourceTable',
      width: 140,
      render: (v: string) => v || '-',
    },
    {
      title: '目标表',
      dataIndex: 'targetTable',
      key: 'targetTable',
      width: 140,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const cfg = statusConfig[v] || statusConfig.pending;
        return <span style={{ color: cfg.color }}>{cfg.label}</span>;
      },
    },
    {
      title: '调度',
      key: 'schedule',
      width: 120,
      render: (_: unknown, record: DataPipeline) => record.schedule || '手动',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: DataPipeline) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={actionLoading === record.id}
            onClick={() => handleExecute(record.id)}
          >
            执行
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ApiOutlined />}
            onClick={() => handleViewLineage(record)}
          >
            血缘
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <ApartmentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            <DatabaseOutlined style={{ marginRight: spacing.sm }} />
            数据管道
          </Title>
          <Text type="secondary">ETL 管道管理、数据流监控和转换规则</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建管道
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="管道总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中" value={stats.running} valueStyle={{ color: colors.primary[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已暂停" value={stats.paused} valueStyle={{ color: colors.warning[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: stats.failed > 0 ? colors.error[400] : undefined }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pipeline List */}
      <Card title="数据管道列表">
        <Table
          columns={pipelineColumns}
          dataSource={pipelines}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建数据管道"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="管道名称"
            name="name"
            rules={[{ required: true, message: '请输入管道名称' }]}
          >
            <Input placeholder="如: user_analytics_etl" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="管道描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="源表" name="sourceTable">
                <Input placeholder="源表名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="目标表" name="targetTable">
                <Input placeholder="目标表名称" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="转换脚本" name="transformationScript">
            <Input.TextArea rows={4} placeholder="SQL 或脚本内容" />
          </Form.Item>
          <Form.Item label="调度表达式 (Cron)" name="schedule">
            <Input placeholder="如: 0 */6 * * *" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Lineage Drawer */}
      <Drawer
        title="数据血缘"
        open={lineageDrawerOpen}
        onClose={() => {
          setLineageDrawerOpen(false);
          setLineageData('');
        }}
        width={600}
      >
        {selectedPipeline && (
          <>
            <div style={{ marginBottom: spacing.md }}>
              <Text strong>管道: {selectedPipeline.name}</Text>
              <br />
              <Text type="secondary">源表: {selectedPipeline.sourceTable || '-'}</Text>
              {' → '}
              <Text type="secondary">目标表: {selectedPipeline.targetTable || '-'}</Text>
            </div>
            <Card title="血缘关系" size="small">
              {lineageLoading ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>加载中...</div>
              ) : (
                <pre style={{
                  background: '#f6f8fa',
                  padding: spacing.md,
                  borderRadius: spacing.sm,
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 400,
                  overflow: 'auto',
                }}>
                  {lineageData || '暂无血缘数据'}
                </pre>
              )}
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default DataPipelinePage;
