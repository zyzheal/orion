/**
 * Data Pipeline Management Page
 * 完整的数据管道管理页面：列表、CRUD、运行/暂停/恢复、状态监控、空状态引导
 *
 * 对接后端 /api/v1/data-pipeline 路由
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Empty,
  Drawer,
  Select,
  Row,
  Col,
  Card,
  Descriptions,
} from 'antd';
import {
  CloudUploadOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import TableCustom, { type TableColumn } from '@/components/Table';
import {
  listDataPipelines,
  createDataPipeline,
  updateDataPipeline,
  deleteDataPipeline,
  runDataPipeline,
  pauseDataPipeline,
  resumeDataPipeline,
  getDataPipelineLogs,
  getDataPipelineLineage,
  type DataPipeline,
  type CreateDataPipelineRequest,
} from '@/api/data-pipeline';
import { colors, spacing } from '@/tokens';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { Option } = Select;

// ==================== 状态配置 ====================

const statusConfig: Record<string, { color: string; label: string }> = {
  running: { color: 'processing', label: '运行中' },
  paused: { color: 'warning', label: '已暂停' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  pending: { color: 'default', label: '等待中' },
};

// ==================== 状态列组件 ====================

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const cfg = statusConfig[status] || statusConfig.pending;
  return (
    <Tag color={cfg.color}>
      {cfg.label}
    </Tag>
  );
};

// ==================== 主组件 ====================

const PipelineManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [pipelines, setPipelines] = useState<DataPipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 创建/编辑弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<DataPipeline | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [form] = Form.useForm<CreateDataPipelineRequest>();

  // 日志/血缘抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerContent, setDrawerContent] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedPipelineName, setSelectedPipelineName] = useState('');

  // 加载列表
  const loadPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDataPipelines();
      const data = Array.isArray(result.data) ? result.data : [];
      setPipelines(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载数据管道列表失败';
      message.error(msg);
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  // ==================== CRUD 操作 ====================

  // 创建/编辑
  const handleCreateOrEdit = async (values: CreateDataPipelineRequest) => {
    setModalLoading(true);
    try {
      if (editingPipeline) {
        await updateDataPipeline(editingPipeline.id, values);
        message.success('数据管道更新成功');
      } else {
        await createDataPipeline(values);
        message.success('数据管道创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingPipeline(null);
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : (editingPipeline ? '更新失败' : '创建失败');
      message.error(msg);
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingPipeline(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleOpenEdit = (pipeline: DataPipeline) => {
    setEditingPipeline(pipeline);
    form.setFieldsValue({
      name: pipeline.name,
      description: pipeline.description,
      sourceTable: pipeline.sourceTable,
      targetTable: pipeline.targetTable,
      transformationScript: pipeline.transformationScript,
      schedule: pipeline.schedule,
    });
    setModalOpen(true);
  };

  // 删除
  const handleDelete = (pipeline: DataPipeline) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除数据管道「${pipeline.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteDataPipeline(pipeline.id);
          message.success('删除成功');
          loadPipelines();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : '删除失败';
          message.error(msg);
        }
      },
    });
  };

  // ==================== 运行操作 ====================

  const setAction = (id: string, loading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [id]: loading }));
  };

  const handleRun = async (pipeline: DataPipeline) => {
    setAction(pipeline.id, true);
    try {
      await runDataPipeline(pipeline.id);
      message.success('管道运行已触发');
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '运行失败';
      message.error(msg);
    } finally {
      setAction(pipeline.id, false);
    }
  };

  const handlePause = async (pipeline: DataPipeline) => {
    setAction(pipeline.id, true);
    try {
      await pauseDataPipeline(pipeline.id);
      message.success('管道已暂停');
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '暂停失败';
      message.error(msg);
    } finally {
      setAction(pipeline.id, false);
    }
  };

  const handleResume = async (pipeline: DataPipeline) => {
    setAction(pipeline.id, true);
    try {
      await resumeDataPipeline(pipeline.id);
      message.success('管道已恢复');
      loadPipelines();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '恢复失败';
      message.error(msg);
    } finally {
      setAction(pipeline.id, false);
    }
  };

  // ==================== 日志/血缘 ====================

  const handleViewLogs = async (pipeline: DataPipeline) => {
    setDrawerTitle(`日志 - ${pipeline.name}`);
    setSelectedPipelineName(pipeline.name);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const result = await getDataPipelineLogs(pipeline.id);
      setDrawerContent(result.logs && result.logs.length > 0
        ? result.logs.join('\n')
        : '暂无日志');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载日志失败';
      message.error(msg);
      setDrawerContent('加载失败，请稍后重试');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleViewLineage = async (pipeline: DataPipeline) => {
    setDrawerTitle(`数据血缘 - ${pipeline.name}`);
    setSelectedPipelineName(pipeline.name);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const result = await getDataPipelineLineage(pipeline.id);
      const lineage = result.lineage || {};
      setDrawerContent(JSON.stringify(lineage, null, 2));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载血缘失败';
      message.error(msg);
      setDrawerContent('加载失败，请稍后重试');
    } finally {
      setDrawerLoading(false);
    }
  };

  // ==================== 筛选 ====================

  const filteredPipelines = useMemo(() => {
    return pipelines.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [p.name, p.description, p.sourceTable, p.targetTable]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [searchQuery, statusFilter, pipelines]);

  // ==================== 表格列 ====================

  const columns: TableColumn<DataPipeline>[] = [
    {
      key: 'name',
      title: '管道名称',
      dataIndex: 'name',
      width: 200,
      render: (value: unknown, record: DataPipeline) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: colors.primary[500], cursor: 'pointer' }}
            onClick={() => navigate(`/data-pipeline/${record.id}`)}>
            {(value as string) || "-"}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }} ellipsis={{ tooltip: record.description }}>
            {record.description || '-'}
          </Text>
        </Space>
      ),
    },
    {
      key: 'source',
      title: '源表',
      dataIndex: 'sourceTable',
      width: 140,
      render: (value: unknown) => (
        <Tag color="blue" style={{ fontSize: spacing[3] }}>
          {(value as string) || '-'}
        </Tag>
      ),
    },
    {
      key: 'target',
      title: '目标表',
      dataIndex: 'targetTable',
      width: 140,
      render: (value: unknown) => (
        <Tag color="green" style={{ fontSize: spacing[3] }}>
          {(value as string) || '-'}
        </Tag>
      ),
    },
    {
      key: 'schedule',
      title: '调度',
      dataIndex: 'schedule',
      width: 120,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3], fontFamily: 'monospace' }}>
          {(value as string) || '手动'}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => <StatusTag status={(value as string) || "-"} />,
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 140,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {(value as string) ? dayjs(value as string).fromNow() : '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: DataPipeline) => (
        <Space size="small" wrap>
          {record.status !== 'running' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={actionLoading[record.id]}
              onClick={() => handleRun(record)}
            >
              运行
            </Button>
          )}
          {record.status === 'running' && (
            <Button
              type="link"
              size="small"
              icon={<PauseCircleOutlined />}
              loading={actionLoading[record.id]}
              onClick={() => handlePause(record)}
            >
              暂停
            </Button>
          )}
          {record.status === 'paused' && (
            <Button
              type="link"
              size="small"
              icon={<ArrowRightOutlined />}
              loading={actionLoading[record.id]}
              onClick={() => handleResume(record)}
            >
              恢复
            </Button>
          )}
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
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
          <Button
            type="link"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => handleViewLogs(record)}
          >
            日志
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DatabaseOutlined />}
            onClick={() => handleViewLineage(record)}
          >
            血缘
          </Button>
        </Space>
      ),
    },
  ];

  // ==================== 渲染 ====================

  return (
    <div style={{ padding: spacing.lg }}>
      {/* 页面头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}>
        <div>
          <Title level={2} style={{
            marginBottom: spacing.sm,
            display: 'flex',
            alignItems: 'center',
          }}>
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            数据管道管理
          </Title>
          <Text type="secondary">
            ETL 管道配置、调度与监控 · 共 {filteredPipelines.length} 条管道
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadPipelines} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建管道
          </Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: spacing.md, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <Row gutter={spacing.md} align="middle">
          <Col flex="auto">
            <Input
              placeholder="搜索管道名称、描述、表名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
          </Col>
          <Col>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 140 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="running">运行中</Option>
              <Option value="paused">已暂停</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
              <Option value="pending">等待中</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 管道列表 */}
      {filteredPipelines.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 0' }}>
          <Empty
            description={
              <Text type="secondary">
                {pipelines.length === 0 ? '暂无数据管道，点击上方按钮创建第一个管道' : '没有匹配的管道'}
              </Text>
            }
          />
          {pipelines.length === 0 && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              style={{ marginTop: spacing.md }}
            >
              创建数据管道
            </Button>
          )}
        </Card>
      ) : (
        <TableCustom
          columns={columns}
          dataSource={filteredPipelines}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          pagination={{
            current: 1,
            pageSize: 10,
            total: pipelines.length,
          }}
        />
      )}

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingPipeline ? '编辑数据管道' : '创建数据管道'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingPipeline(null);
          form.resetFields();
        }}
        onOk={() => form.validateFields().then(() => form.submit())}
        confirmLoading={modalLoading}
        width={700}
        okText={editingPipeline ? '保存' : '创建'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrEdit}>
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
          <Row gutter={spacing.md}>
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
            <Input placeholder="如: 0 */6 * * * (每6小时执行一次)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 日志/血缘抽屉 */}
      <Drawer
        title={drawerTitle}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerContent('');
        }}
        width={600}
      >
        {selectedPipelineName && (
          <Card size="small" style={{ marginBottom: spacing.md }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="管道">{selectedPipelineName}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}
        <Card
          title={drawerTitle.includes('日志') ? '执行日志' : '数据血缘'}
          size="small"
        >
          {drawerLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>加载中...</div>
          ) : (
            <pre style={{
              background: '#f6f8fa',
              padding: spacing.md,
              borderRadius: spacing.sm,
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 400,
              overflow: 'auto',
            }}>
              {drawerContent}
            </pre>
          )}
        </Card>
      </Drawer>
    </div>
  );
};

export default PipelineManagementPage;
