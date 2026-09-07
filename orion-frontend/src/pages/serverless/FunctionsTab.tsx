/**
 * Serverless Page - FunctionsTab
 * 从 ServerlessPage.tsx 抽出的 FunctionsTab tab。
 */
import React, { useState, useEffect } from 'react';
import { Typography, Table, Button, Tag, Space, message, Modal, Form, Input, Select, Popconfirm, Row, Col, Descriptions, Empty, Tooltip, Drawer } from 'antd';
import { CloudUploadOutlined, PlusOutlined, ReloadOutlined, PlayCircleOutlined, DeleteOutlined, RocketOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons';
import { createServerlessFunction, listServerlessFunctions, getServerlessFunction, updateServerlessFunction, deleteServerlessFunction, deployServerlessFunction, invokeServerlessFunction, getFunctionLogs, type ServerlessFunction as Fn, type ServerlessDeployment, type ServerlessLog, type FunctionStatus, type FunctionRuntime } from '@/api/serverless';
import { useQuery } from '@/providers/QueryProvider';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { statusColorMap, statusLabelMap, runtimeLabelMap } from './ServerlessConfig';
import { logsColumns } from './ServerlessColumns';

const { Title, Text, Paragraph } = Typography;


export const FunctionsTab: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [invokeModalOpen, setInvokeModalOpen] = useState(false);
  const [logsDrawerOpen, setLogsDrawerOpen] = useState(false);
  const [deployDrawerOpen, setDeployDrawerOpen] = useState(false);
  const [currentFn, setCurrentFn] = useState<Fn | null>(null);
  const [logs, setLogs] = useState<ServerlessLog[]>([]);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [invokeForm] = Form.useForm();
  const [invokeLoading, setInvokeLoading] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);

  const {
    data: functions = [] as Fn[],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<Fn[]>({
    queryKey: ['serverless', 'functions'],
    queryFn: async () => {
      const res = await listServerlessFunctions();
      return (res.data as { data?: Fn[] })?.data ?? [];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载函数列表失败');
  }, [isError, error]);

  const handleCreate = async (values: any) => {
    try {
      await createServerlessFunction({
        name: values.name,
        description: values.description,
        runtime: values.runtime,
        handler: values.handler,
        memory: Number(values.memory),
        timeout: Number(values.timeout),
        code: values.code,
        replicas: { min: Number(values.replicasMin), max: Number(values.replicasMax) },
      });
      message.success('函数创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleEdit = async (values: any) => {
    if (!currentFn) return;
    try {
      await updateServerlessFunction(currentFn.id, {
        name: values.name,
        description: values.description,
        runtime: values.runtime,
        handler: values.handler,
        memory: Number(values.memory),
        timeout: Number(values.timeout),
        replicas: { min: Number(values.replicasMin), max: Number(values.replicasMax) },
      });
      message.success('函数更新成功');
      setEditModalOpen(false);
      editForm.resetFields();
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新失败');
    }
  };

  const handleDelete = async (fn: Fn) => {
    try {
      await deleteServerlessFunction(fn.id);
      message.success('函数删除成功');
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleDeploy = async () => {
    if (!currentFn) return;
    setDeployLoading(true);
    try {
      const res = await deployServerlessFunction(currentFn.id);
      const dep = (res.data as { data?: ServerlessDeployment })?.data;
      if (dep?.status === 'success') {
        message.success(`函数 ${currentFn.name} 部署成功`);
      } else {
        message.warning(`部署状态: ${dep?.status || '未知'}`);
      }
      setDeployDrawerOpen(false);
      refetch();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '部署失败');
    } finally {
      setDeployLoading(false);
    }
  };

  const handleInvoke = async (values: any) => {
    if (!currentFn) return;
    setInvokeLoading(true);
    try {
      let payload: Record<string, unknown> | undefined;
      if (values.payload) {
        try {
          payload = JSON.parse(values.payload);
        } catch {
          payload = { raw: values.payload };
        }
      }
      await invokeServerlessFunction(currentFn.id, payload);
      message.success('函数调用成功');
      setInvokeModalOpen(false);
      invokeForm.resetFields();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '调用失败');
    } finally {
      setInvokeLoading(false);
    }
  };

  const handleViewLogs = async (fn: Fn) => {
    setCurrentFn(fn);
    setLogsDrawerOpen(true);
    try {
      const res = await getFunctionLogs(fn.id, { limit: 50 });
      setLogs((res.data as { data?: ServerlessLog[] })?.data ?? []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载日志失败');
    }
  };

  const handleViewDetail = async (fn: Fn) => {
    setCurrentFn(fn);
    setDetailDrawerOpen(true);
    try {
      const res = await getServerlessFunction(fn.id);
      setCurrentFn((res.data as { data?: Fn })?.data ?? fn);
    } catch {
      /* use existing data */
    }
  };

  const handleOpenEdit = (fn: Fn) => {
    setCurrentFn(fn);
    editForm.setFieldsValue({
      name: fn.name,
      description: fn.description,
      runtime: fn.runtime,
      handler: fn.handler,
      memory: fn.memory,
      timeout: fn.timeout,
      replicasMin: fn.replicas.min,
      replicasMax: fn.replicas.max,
    });
    setEditModalOpen(true);
  };

  const columns = [
    {
      title: '函数名称',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, r: Fn) => <a onClick={() => handleViewDetail(r)}>{v}</a>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '运行时',
      dataIndex: 'runtime',
      key: 'runtime',
      render: (r: FunctionRuntime) => (
        <Tag color={colors.primary[500]}>{runtimeLabelMap[r] || r}</Tag>
      ),
    },
    { title: '处理器', dataIndex: 'handler', key: 'handler' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: FunctionStatus) => <Tag color={statusColorMap[s]}>{statusLabelMap[s]}</Tag>,
    },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: number) => `v${v}` },
    {
      title: '副本',
      dataIndex: 'replicas',
      key: 'replicas',
      render: (r: Fn['replicas']) => `${r.current} / ${r.min}-${r.max}`,
    },
    { title: '内存', dataIndex: 'memory', key: 'memory', render: (v: number) => `${v} MB` },
    { title: '超时', dataIndex: 'timeout', key: 'timeout', render: (v: number) => `${v}s` },
    {
      title: '端点',
      dataIndex: 'endpoint',
      key: 'endpoint',
      ellipsis: true,
      render: (v: string) =>
        v ? (
          <Tooltip title={v}>
            <a href={v} target="_blank" rel="noreferrer">
              {v}
            </a>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, fn: Fn) => (
        <Space>
          <Tooltip title="部署">
            <Button
              size="small"
              icon={<RocketOutlined />}
              onClick={() => {
                setCurrentFn(fn);
                setDeployDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="调用">
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => {
                setCurrentFn(fn);
                setInvokeModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="日志">
            <Button size="small" icon={<FileTextOutlined />} onClick={() => handleViewLogs(fn)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button size="small" icon={<SettingOutlined />} onClick={() => handleOpenEdit(fn)} />
          </Tooltip>
          <Popconfirm title="确认删除此函数？" onConfirm={() => handleDelete(fn)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Serverless 函数
          </Title>
          <Text type="secondary">管理无服务器函数的创建、部署、调用与监控</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setCreateModalOpen(true);
            }}
          >
            创建函数
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={functions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: (
            <Empty description="暂无函数" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields();
                  setCreateModalOpen(true);
                }}
              >
                创建第一个函数
              </Button>
            </Empty>
          ),
        }}
      />

      {/* Create Modal */}
      <Modal
        title="创建 Serverless 函数"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="函数名称"
            name="name"
            rules={[{ required: true, message: '请输入函数名称' }]}
          >
            <Input placeholder="如: hello-world" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="函数功能描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="运行时"
                name="runtime"
                rules={[{ required: true }]}
                initialValue="nodejs18"
              >
                <Select>
                  <Select.Option value="nodejs18">Node.js 18</Select.Option>
                  <Select.Option value="nodejs20">Node.js 20</Select.Option>
                  <Select.Option value="python3.9">Python 3.9</Select.Option>
                  <Select.Option value="python3.11">Python 3.11</Select.Option>
                  <Select.Option value="go1.21">Go 1.21</Select.Option>
                  <Select.Option value="java17">Java 17</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="处理器"
                name="handler"
                rules={[{ required: true }]}
                initialValue="index.handler"
              >
                <Input placeholder="如: index.handler" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="内存 (MB)"
                name="memory"
                rules={[{ required: true }]}
                initialValue={256}
              >
                <Input type="number" min={128} max={3008} step={128} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="超时 (秒)"
                name="timeout"
                rules={[{ required: true }]}
                initialValue={30}
              >
                <Input type="number" min={1} max={900} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="代码 (Base64)" name="code" rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="Base64 编码的代码内容" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="最小副本" name="replicasMin" initialValue={0}>
                <Input type="number" min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="最大副本" name="replicasMax" initialValue={10}>
                <Input type="number" min={1} max={1000} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑函数"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        width={700}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="函数名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="运行时" name="runtime" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="nodejs18">Node.js 18</Select.Option>
                  <Select.Option value="nodejs20">Node.js 20</Select.Option>
                  <Select.Option value="python3.9">Python 3.9</Select.Option>
                  <Select.Option value="python3.11">Python 3.11</Select.Option>
                  <Select.Option value="go1.21">Go 1.21</Select.Option>
                  <Select.Option value="java17">Java 17</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="处理器" name="handler" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="内存 (MB)" name="memory" rules={[{ required: true }]}>
                <Input type="number" min={128} max={3008} step={128} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="超时 (秒)" name="timeout" rules={[{ required: true }]}>
                <Input type="number" min={1} max={900} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="最大副本" name="replicasMax">
                <Input type="number" min={1} max={1000} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Invoke Modal */}
      <Modal
        title="调用函数"
        open={invokeModalOpen}
        onCancel={() => setInvokeModalOpen(false)}
        onOk={() => invokeForm.submit()}
        confirmLoading={invokeLoading}
      >
        <Text>
          函数: <strong>{currentFn?.name}</strong>
        </Text>
        <Form
          form={invokeForm}
          layout="vertical"
          onFinish={handleInvoke}
          style={{ marginTop: spacing.md }}
        >
          <Form.Item label="Payload (JSON)" name="payload">
            <Input.TextArea rows={4} placeholder='{"key": "value"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title="函数详情"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={600}
      >
        {currentFn && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="名称" span={2}>
              {currentFn.name}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {currentFn.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="运行时">
              {runtimeLabelMap[currentFn.runtime]}
            </Descriptions.Item>
            <Descriptions.Item label="处理器">{currentFn.handler}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[currentFn.status]}>{statusLabelMap[currentFn.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="版本">v{currentFn.version}</Descriptions.Item>
            <Descriptions.Item label="内存">{currentFn.memory} MB</Descriptions.Item>
            <Descriptions.Item label="超时">{currentFn.timeout}s</Descriptions.Item>
            <Descriptions.Item label="最小副本">{currentFn.replicas.min}</Descriptions.Item>
            <Descriptions.Item label="最大副本">{currentFn.replicas.max}</Descriptions.Item>
            <Descriptions.Item label="当前副本">{currentFn.replicas.current}</Descriptions.Item>
            <Descriptions.Item label="端点" span={2}>
              {currentFn.endpoint || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {new Date(currentFn.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间" span={2}>
              {new Date(currentFn.updatedAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="最近部署" span={2}>
              {currentFn.lastDeployedAt ? new Date(currentFn.lastDeployedAt).toLocaleString() : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* Deploy Drawer */}
      <Drawer
        title="部署函数"
        open={deployDrawerOpen}
        onClose={() => setDeployDrawerOpen(false)}
        width={500}
      >
        {currentFn && (
          <div>
            <Paragraph>
              即将部署 <strong>{currentFn.name}</strong> (v{currentFn.version + 1})
            </Paragraph>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="函数">{currentFn.name}</Descriptions.Item>
              <Descriptions.Item label="当前版本">v{currentFn.version}</Descriptions.Item>
              <Descriptions.Item label="部署后版本">v{currentFn.version + 1}</Descriptions.Item>
              <Descriptions.Item label="运行时">
                {runtimeLabelMap[currentFn.runtime]}
              </Descriptions.Item>
              <Descriptions.Item label="内存">{currentFn.memory} MB</Descriptions.Item>
            </Descriptions>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              onClick={handleDeploy}
              loading={deployLoading}
              block
            >
              开始部署
            </Button>
          </div>
        )}
      </Drawer>

      {/* Logs Drawer */}
      <Drawer
        title="函数日志"
        open={logsDrawerOpen}
        onClose={() => setLogsDrawerOpen(false)}
        width={700}
      >
        {currentFn && (
          <div>
            <Paragraph>
              函数: <strong>{currentFn.name}</strong>
            </Paragraph>
            <Table
              columns={logsColumns}
              dataSource={logs}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              size="small"
              locale={{
                emptyText: <Empty description="暂无日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

// ============================================================================
// Triggers Tab
// ============================================================================

