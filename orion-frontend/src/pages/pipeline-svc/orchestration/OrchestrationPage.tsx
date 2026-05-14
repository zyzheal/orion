/**
 * Cross-Domain Orchestration Page
 * Phase 3 - Multi-service pipeline orchestration, dependency management, and workflow visualization
 *
 * Features:
 * - Workflow list with status, domains, progress
 * - Create new orchestration workflows
 * - Execute/pause/resume/abort workflows
 * - Workflow detail view with step breakdown
 * - Service dependency table
 * - Stats overview
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Descriptions,
  Table,
  Drawer,
  Progress,
} from 'antd';
import {
  BranchesOutlined,
  PlusOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  orchestrationApi,
  type OrchestrationFlow,
  type OrchestrationStep,
  type CreateOrchestrationInput,
} from '@/api/orchestration';

const { Title, Text } = Typography;

// Status color mapping
const statusColorMap: Record<string, string> = {
  draft: 'default',
  active: 'blue',
  paused: 'gold',
  running: 'processing',
  completed: 'green',
  aborted: 'default',
  failed: 'red',
};

const statusLabelMap: Record<string, string> = {
  draft: '草稿',
  active: '活跃',
  paused: '已暂停',
  running: '运行中',
  completed: '已完成',
  aborted: '已中止',
  failed: '失败',
};

// Step status color
const stepStatusColor: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'green',
  failed: 'red',
  skipped: 'default',
};

const stepStatusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

// Domain options for creation
const domainOptions = [
  { value: 'build', label: '构建 (Build)' },
  { value: 'test', label: '测试 (Test)' },
  { value: 'deploy', label: '部署 (Deploy)' },
  { value: 'security', label: '安全 (Security)' },
  { value: 'monitoring', label: '监控 (Monitoring)' },
  { value: 'multi-cloud', label: '多云 (Multi-Cloud)' },
  { value: 'sync', label: '同步 (Sync)' },
  { value: 'networking', label: '网络 (Networking)' },
  { value: 'database', label: '数据库 (Database)' },
];

const OrchestrationPage: React.FC = () => {
  const [flows, setFlows] = useState<OrchestrationFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailFlow, setDetailFlow] = useState<OrchestrationFlow | null>(null);
  const [form] = Form.useForm();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await orchestrationApi.list();
      setFlows(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      message.error(`加载编排数据失败: ${(error as Error).message}`);
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      const input: CreateOrchestrationInput = {
        name: values.name,
        description: values.description || '',
        domains: values.domains || [],
        steps: (values.steps || []).map((s: any, i: number) => ({
          name: s.name || `Step ${i + 1}`,
          domain: s.domain,
          action: s.action || 'execute',
          config: s.config || {},
          dependsOn: s.dependsOn || [],
        })),
      };
      await orchestrationApi.create(input);
      message.success('工作流创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(`创建工作流失败: ${(error as Error).message}`);
    }
  };

  const handleExecute = async (id: string) => {
    setActionLoading(id);
    try {
      await orchestrationApi.execute(id);
      message.success('工作流已启动');
      loadData();
    } catch (error: unknown) {
      message.error(`启动失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      await orchestrationApi.pause(id);
      message.success('工作流已暂停');
      loadData();
    } catch (error: unknown) {
      message.error(`暂停失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      await orchestrationApi.resume(id);
      message.success('工作流已恢复');
      loadData();
    } catch (error: unknown) {
      message.error(`恢复失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAbort = async (id: string) => {
    setActionLoading(id);
    try {
      await orchestrationApi.abort(id);
      message.success('工作流已中止');
      loadData();
    } catch (error: unknown) {
      message.error(`中止失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Stats
  const stats = {
    total: flows.length,
    active: flows.filter((f) => f.status === 'active').length,
    failed: flows.filter((f) => f.status === 'failed').length,
    completed: flows.filter((f) => f.status === 'completed').length,
  };

  // Workflow table columns
  const workflowColumns = [
    {
      title: '工作流名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (v: string, record: OrchestrationFlow) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => setDetailFlow(record)}>
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: record.description }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '领域',
      dataIndex: 'domains',
      key: 'domains',
      width: 180,
      render: (domains: string[]) =>
        (domains || []).slice(0, 3).map((d: string) => <Tag key={d}>{d}</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v}</Tag>,
    },
    {
      title: '步骤进度',
      key: 'progress',
      width: 160,
      render: (_: unknown, record: OrchestrationFlow) => {
        const steps = record.steps || [];
        const completed = steps.filter((s) => s.status === 'completed').length;
        const total = steps.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Progress percent={percent} size="small" status={record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {completed}/{total} 步骤
            </Text>
          </Space>
        );
      },
    },
    {
      title: '创建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 120,
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: OrchestrationFlow) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailFlow(record)}
          >
            详情
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={actionLoading === record.id}
              onClick={() => handleExecute(record.id)}
            >
              执行
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              type="link"
              size="small"
              icon={<PauseCircleOutlined />}
              loading={actionLoading === record.id}
              onClick={() => handlePause(record.id)}
            >
              暂停
            </Button>
          )}
          {record.status === 'paused' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={actionLoading === record.id}
              onClick={() => handleResume(record.id)}
            >
              恢复
            </Button>
          )}
          {(record.status === 'active' || record.status === 'paused') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<StopOutlined />}
              loading={actionLoading === record.id}
              onClick={() => handleAbort(record.id)}
            >
              中止
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Dependency table columns
  const dependencyColumns = [
    {
      title: '步骤名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
    },
    {
      title: '领域',
      dataIndex: 'domain',
      key: 'domain',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 120,
    },
    {
      title: '依赖',
      key: 'dependsOn',
      width: 140,
      render: (_: unknown, record: OrchestrationStep) => {
        const deps = record.dependsOn || [];
        return deps.length > 0 ? deps.map((d: string) => <Tag key={d}>{d}</Tag>) : <Text type="secondary">无</Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={stepStatusColor[v] || 'default'}>{stepStatusLabel[v] || v}</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BranchesOutlined style={{ marginRight: 8 }} />
            跨域编排
          </Title>
          <Text type="secondary">管理服务编排工作流和依赖关系</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建工作流
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="工作流总数" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃"
              value={stats.active}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败"
              value={stats.failed}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Workflow List */}
      <Card title="编排工作流" style={{ marginBottom: 24 }}>
        <Table
          columns={workflowColumns}
          dataSource={flows}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Dependencies */}
      <Card title={<><AppstoreOutlined /> 步骤依赖关系</>}>
        <Table
          columns={dependencyColumns}
          dataSource={flows.flatMap((f) => (f.steps || []).map((s) => ({ ...s, flowId: f.id, flowName: f.name })))}
          rowKey={(record) => `${record.flowId}-${record.id}`}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建编排工作流"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入工作流名称' }]}>
            <Input placeholder="工作流名称" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="工作流描述" />
          </Form.Item>
          <Form.Item label="领域" name="domains" rules={[{ required: true, message: '请选择至少一个领域' }]}>
            <Select
              mode="multiple"
              placeholder="选择相关领域"
              options={domainOptions}
            />
          </Form.Item>
          <Form.Item label="步骤配置 (JSON)" name="stepsJson">
            <Input.TextArea
              rows={6}
              placeholder={'[\n  {"name": "Build", "domain": "build", "action": "execute"},\n  {"name": "Test", "domain": "test", "action": "execute", "dependsOn": ["Build"]}\n]'}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title="工作流详情"
        open={!!detailFlow}
        onClose={() => setDetailFlow(null)}
        width={800}
      >
        {detailFlow && (
          <>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="名称" span={2}>{detailFlow.name}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{detailFlow.description}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[detailFlow.status]}>{statusLabelMap[detailFlow.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建者">{detailFlow.createdBy}</Descriptions.Item>
              <Descriptions.Item label="领域" span={2}>
                {(detailFlow.domains || []).map((d: string) => <Tag key={d}>{d}</Tag>)}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{new Date(detailFlow.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{new Date(detailFlow.updatedAt).toLocaleString('zh-CN')}</Descriptions.Item>
            </Descriptions>

            {/* Steps */}
            <Card title="步骤详情" size="small" style={{ marginTop: 16 }}>
              <Table
                columns={dependencyColumns}
                dataSource={detailFlow.steps || []}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default OrchestrationPage;
