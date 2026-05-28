/**
 * Visor (Ops Visualization) Page
 * Host management, script execution, resource monitoring
 * Three-tab layout: 主机管理 | 脚本执行 | 资源监控
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Spin,
  Popconfirm,
  Badge,
  Statistic,
  Row,
  Col,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DashboardOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  CpuOutlined,
  DesktopOutlined,
  HddOutlined,
  GlobalOutlined,
  MonitorOutlined,} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import {
  listHosts,
  addHost,
  removeHost,
  getHostStatus,
  executeScript,
  getScriptResult,
  listResources,
  getResourcesByType,
  type Host,
  type AddHostInput,
  type ScriptExecution,
  type ResourceUsage,
} from '@/api/visor';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ---- Color Maps ----

const hostStatusColorMap: Record<Host['status'], string> = {
  online: 'green',
  offline: 'default',
  error: 'red',
  maintenance: 'orange',
};

const hostStatusLabelMap: Record<Host['status'], string> = {
  online: '在线',
  offline: '离线',
  error: '异常',
  maintenance: '维护中',
};

const scriptStatusColorMap: Record<ScriptExecution['status'], string> = {
  pending: 'blue',
  running: 'orange',
  success: 'green',
  failed: 'red',
  timeout: 'magenta',
};

const scriptStatusLabelMap: Record<ScriptExecution['status'], string> = {
  pending: '等待中',
  running: '执行中',
  success: '成功',
  failed: '失败',
  timeout: '超时',
};

// ---- Main Component ----

const VisorPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('hosts');

  // Hosts state
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostLoading, setHostLoading] = useState(false);
  const [hostModalVisible, setHostModalVisible] = useState(false);
  const [hostForm] = Form.useForm();
  const [hostSubmitting, setHostSubmitting] = useState(false);

  // Scripts state
  const [scripts, setScripts] = useState<ScriptExecution[]>([]);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptForm] = Form.useForm();
  const [scriptExecuting, setScriptExecuting] = useState(false);
  const [scriptResult, setScriptResult] = useState<ScriptExecution | null>(null);
  const [viewingResult, setViewingResult] = useState(false);

  // Resources state
  const [resources, setResources] = useState<ResourceUsage[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');

  // ---- Data Loading ----

  const loadHosts = async () => {
    setHostLoading(true);
    try {
      const res = await listHosts();
      const list = res.data?.data?.hosts;
      setHosts(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setHosts([]);
      message.error(`加载主机列表失败: ${(error as Error).message}`);
    } finally {
      setHostLoading(false);
    }
  };

  const loadScripts = async () => {
    setScriptLoading(true);
    try {
      // Reuse hosts list for script history display
      const res = await listHosts();
      const list = res.data?.data?.scripts;
      setScripts(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setScripts([]);
    } finally {
      setScriptLoading(false);
    }
  };

  const loadResources = async () => {
    setResourceLoading(true);
    try {
      const res = await listResources();
      const list = res.data?.data?.resources;
      setResources(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setResources([]);
      message.error(`加载资源数据失败: ${(error as Error).message}`);
    } finally {
      setResourceLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadHosts(), loadScripts(), loadResources()]).finally(() =>
      setLoading(false)
    );
  }, []);

  // ---- Host Handlers ----

  const handleAddHost = async () => {
    try {
      const values = await hostForm.validateFields();
      setHostSubmitting(true);
      const payload: AddHostInput = {
        hostname: values.hostname,
        ip: values.ip,
        os: values.os || 'linux',
      };
      await addHost(payload);
      message.success('主机添加成功');
      setHostModalVisible(false);
      hostForm.resetFields();
      loadHosts();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`添加失败: ${(error as Error).message}`);
      }
    } finally {
      setHostSubmitting(false);
    }
  };

  const handleRemoveHost = async (id: string) => {
    try {
      await removeHost(id);
      message.success('主机已移除');
      loadHosts();
    } catch (error: unknown) {
      message.error(`移除失败: ${(error as Error).message}`);
    }
  };

  const handleViewHostStatus = async (id: string) => {
    try {
      const res = await getHostStatus(id);
      const data = res.data?.data;
      message.info(`主机状态: ${data?.status || 'unknown'}`);
    } catch (error: unknown) {
      message.error(`获取状态失败: ${(error as Error).message}`);
    }
  };

  // ---- Script Handlers ----

  const handleExecuteScript = async () => {
    try {
      const values = await scriptForm.validateFields();
      setScriptExecuting(true);
      await executeScript({
        hostId: values.hostId,
        script: values.script,
      });
      message.success('脚本已提交执行');
      scriptForm.resetFields();
      loadScripts();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`执行失败: ${(error as Error).message}`);
      }
    } finally {
      setScriptExecuting(false);
    }
  };

  const handleViewScriptResult = async (id: string) => {
    try {
      const res = await getScriptResult(id);
      const data = res.data?.data;
      setScriptResult(data);
      setViewingResult(true);
    } catch (error: unknown) {
      message.error(`获取结果失败: ${(error as Error).message}`);
    }
  };

  // ---- Resource Handlers ----

  const handleFilterByType = async (type: string) => {
    setResourceTypeFilter(type);
    if (type === 'all') {
      await loadResources();
    } else {
      try {
        const res = await getResourcesByType(type);
        const list = res.data?.data?.resources;
        setResources(Array.isArray(list) ? list : []);
      } catch (error: unknown) {
        setResources([]);
        message.error(`加载资源失败: ${(error as Error).message}`);
      }
    }
  };

  // ---- Filtered Data ----

  const filteredResources =
    resourceTypeFilter === 'all'
      ? resources
      : resources.filter((r) => r.type === resourceTypeFilter);

  // ---- Stats ----

  const hostStats = {
    total: hosts.length,
    online: hosts.filter((h) => h.status === 'online').length,
    offline: hosts.filter((h) => h.status === 'offline').length,
    error: hosts.filter((h) => h.status === 'error').length,
  };

  // ---- Host Table Columns ----

  const hostColumns: TableColumn<Host>[] = [
    {
      key: 'hostname',
      title: '主机名',
      dataIndex: 'hostname',
      width: 180,
      render: (v: unknown) => (
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{String(v)}</Text>
        </Space>
      ),
    },
    {
      key: 'ip',
      title: 'IP地址',
      dataIndex: 'ip',
      width: 150,
      render: (v: unknown) => <Text code>{String(v)}</Text>,
    },
    {
      key: 'os',
      title: '操作系统',
      dataIndex: 'os',
      width: 120,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: unknown) => {
        const status = v as Host['status'];
        return <Badge status={status === 'online' ? 'success' : status === 'error' ? 'error' : 'default'} text={hostStatusLabelMap[status]} />;
      },
    },
    {
      key: 'cpuUsage',
      title: 'CPU',
      dataIndex: 'cpuUsage',
      width: 80,
      render: (v: unknown) =>
        v != null ? (
          <Tag color={(v as number) > 80 ? 'red' : (v as number) > 50 ? 'orange' : 'green'}>
            {v}%
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'memoryUsage',
      title: '内存',
      dataIndex: 'memoryUsage',
      width: 80,
      render: (v: unknown) =>
        v != null ? (
          <Tag color={(v as number) > 80 ? 'red' : (v as number) > 50 ? 'orange' : 'green'}>
            {v}%
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 180,
      render: (_: unknown, record: Host) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewHostStatus(record.id)}
          >
            状态
          </Button>
          <Popconfirm title="确认移除此主机？" onConfirm={() => handleRemoveHost(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              移除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Script Table Columns ----

  const scriptColumns: TableColumn<ScriptExecution>[] = [
    {
      key: 'id',
      title: '执行ID',
      dataIndex: 'id',
      width: 120,
      render: (v: unknown) => <Text code>{String(v).slice(0, 8)}</Text>,
    },
    {
      key: 'hostname',
      title: '目标主机',
      dataIndex: 'hostname',
      width: 150,
      render: (v: unknown) => (
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          <Text>{v ? String(v) : '-'}</Text>
        </Space>
      ),
    },
    {
      key: 'script',
      title: '脚本',
      dataIndex: 'script',
      ellipsis: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 12 }}>
          {String(v).slice(0, 50)}
          {String(v).length > 50 ? '...' : ''}
        </Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: unknown) => (
        <Tag color={scriptStatusColorMap[v as ScriptExecution['status']]}>
          {scriptStatusLabelMap[v as ScriptExecution['status']]}
        </Tag>
      ),
    },
    {
      key: 'createdAt',
      title: '执行时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: unknown) => <Text type="secondary">{String(v)}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 100,
      render: (_: unknown, record: ScriptExecution) =>
        record.status === 'success' || record.status === 'failed' ? (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewScriptResult(record.id)}
          >
            查看结果
          </Button>
        ) : null,
    },
  ];

  // ---- Resource Type Icon Map ----

  const resourceTypeIconMap: Record<string, React.ReactNode> = {
    cpu: <CpuOutlined style={{ fontSize: 24, color: colors.primary[500] }} />,
    memory: <DesktopOutlined style={{ fontSize: 24, color: colors.purple[500] }} />,
    disk: <HddOutlined style={{ fontSize: 24, color: colors.warning[500] }} />,
    network: <GlobalOutlined style={{ fontSize: 24, color: colors.success[500] }} />,
  };

  const resourceTypeLabelMap: Record<string, string> = {
    cpu: 'CPU使用率',
    memory: '内存使用率',
    disk: '磁盘使用率',
    network: '网络流量',
  };

  const filteredResourcesByHost = filteredResources.reduce<Record<string, ResourceUsage[]>>(
    (acc, r) => {
      if (!acc[r.hostId]) acc[r.hostId] = [];
      acc[r.hostId].push(r);
      return acc;
    },
    {} as Record<string, ResourceUsage[]>
  );

  // ---- Tab Items ----

  const hostsTab = (
    <div>
      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="主机总数" value={hostStats.total} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="在线"
              value={hostStats.online}
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="离线" value={hostStats.offline} valueStyle={{ color: colors.neutral[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="异常"
              value={hostStats.error}
              valueStyle={{ color: colors.error[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadHosts} loading={hostLoading}>
            刷新
          </Button>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setHostModalVisible(true)}
        >
          添加主机
        </Button>
      </div>

      {/* Hosts Table */}
      <Table
        columns={hostColumns}
        dataSource={hosts}
        loading={hostLoading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Add Host Modal */}
      <Modal
        title="添加主机"
        open={hostModalVisible}
        onCancel={() => setHostModalVisible(false)}
        onOk={handleAddHost}
        confirmLoading={hostSubmitting}
        width={500}
        destroyOnClose
      >
        <Form form={hostForm} layout="vertical">
          <Form.Item
            name="hostname"
            label="主机名"
            rules={[{ required: true, message: '请输入主机名' }]}
          >
            <Input placeholder="如: prod-web-01" />
          </Form.Item>
          <Form.Item
            name="ip"
            label="IP地址"
            rules={[{ required: true, message: '请输入IP地址' }]}
          >
            <Input placeholder="如: 10.0.0.1" />
          </Form.Item>
          <Form.Item name="os" label="操作系统" initialValue="linux">
            <Select
              options={[
                { label: 'Linux', value: 'linux' },
                { label: 'Windows', value: 'windows' },
                { label: 'macOS', value: 'macos' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const scriptsTab = (
    <div>
      {/* Script Execution Form */}
      <Card title="执行脚本" size="small" style={{ marginBottom: 16 }}>
        <Form form={scriptForm} layout="vertical">
          <Form.Item
            name="hostId"
            label="目标主机"
            rules={[{ required: true, message: '请选择目标主机' }]}
          >
            <Select
              placeholder="选择主机..."
              options={hosts
                .filter((h) => h.status === 'online')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.id }))}
            />
          </Form.Item>
          <Form.Item
            name="script"
            label="脚本内容"
            rules={[{ required: true, message: '请输入脚本内容' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder="#!/bin/bash&#10;echo 'Hello World'"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecuteScript}
              loading={scriptExecuting}
            >
              执行脚本
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Script History */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={loadScripts} loading={scriptLoading}>
          刷新
        </Button>
      </div>
      <Table
        columns={scriptColumns}
        dataSource={scripts}
        loading={scriptLoading}
        rowKey="id"
        size="middle"
        striped
      />

      {/* Script Result Modal */}
      <Modal
        title="脚本执行结果"
        open={viewingResult}
        onCancel={() => {
          setViewingResult(false);
          setScriptResult(null);
        }}
        footer={
          <Button onClick={() => { setViewingResult(false); setScriptResult(null); }}>关闭</Button>
        }
        width={700}
      >
        {scriptResult && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="执行ID">{scriptResult.id.slice(0, 8)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={scriptStatusColorMap[scriptResult.status]}>
                  {scriptStatusLabelMap[scriptResult.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="退出码">
                {scriptResult.exitCode != null ? scriptResult.exitCode : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{scriptResult.startedAt || '-'}</Descriptions.Item>
            </Descriptions>
            {scriptResult.stdout && (
              <div style={{ marginBottom: 8 }}>
                <Text strong>标准输出:</Text>
                <pre
                  style={{
                    background: colors.neutral[50],
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 12,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {scriptResult.stdout}
                </pre>
              </div>
            )}
            {scriptResult.stderr && (
              <div>
                <Text strong type="danger">标准错误:</Text>
                <pre
                  style={{
                    background: colors.error[50],
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 12,
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {scriptResult.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );

  const resourcesTab = (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 140 }}
            value={resourceTypeFilter}
            onChange={handleFilterByType}
            options={[
              { label: '全部类型', value: 'all' },
              { label: 'CPU', value: 'cpu' },
              { label: '内存', value: 'memory' },
              { label: '磁盘', value: 'disk' },
              { label: '网络', value: 'network' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadResources} loading={resourceLoading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* Resource Cards */}
      <Spin spinning={resourceLoading}>
        {Object.keys(filteredResourcesByHost).length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <DashboardOutlined style={{ fontSize: 48, color: colors.neutral[300] }} />
            <p style={{ marginTop: 16, color: colors.neutral[500] }}>暂无资源监控数据</p>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {Object.entries(filteredResourcesByHost).map(([hostId, resList]) => {
              const host = hosts.find((h) => h.id === hostId);
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={hostId}>
                  <Card
                    size="small"
                    title={
                      <Space>
                        <CloudServerOutlined />
                        {host?.hostname || hostId.slice(0, 8)}
                      </Space>
                    }
                  >
                    {resList.map((r) => (
                      <div
                        key={r.type}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 12,
                        }}
                      >
                        <Space>
                          {resourceTypeIconMap[r.type] || <DashboardOutlined />}
                          <Text>{resourceTypeLabelMap[r.type] || r.type}</Text>
                        </Space>
                        <Space>
                          <Tag
                            color={
                              r.usage > 80
                                ? 'red'
                                : r.usage > 50
                                  ? 'orange'
                                  : 'green'
                            }
                          >
                            {r.usage}
                            {r.unit}
                          </Tag>
                        </Space>
                      </div>
                    ))}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      更新时间: {resList[0]?.timestamp || '-'}
                    </Text>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Spin>
    </div>
  );

  const tabItems = [
    {
      key: 'hosts',
      label: (
        <span>
          <CloudServerOutlined /> 主机管理
        </span>
      ),
      children: hostsTab,
    },
    {
      key: 'scripts',
      label: (
        <span>
          <CodeOutlined /> 脚本执行
        </span>
      ),
      children: scriptsTab,
    },
    {
      key: 'resources',
      label: (
        <span>
          <DashboardOutlined /> 资源监控
        </span>
      ),
      children: resourcesTab,
    },
  ];

  const isInitialLoading = loading && hosts.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={4} rows={8} />
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ marginBottom: 8 }}>
            <MonitorOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              <CloudServerOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              运维可视化
            </Title>
            <Text type="secondary">主机管理、脚本执行与资源监控</Text>
          </div>

          {/* Tabs */}
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </>
      )}
    </div>
  );
};

export default VisorPage;
