/**
 * Batch Command Execution for CMDB
 * 批量命令执行、执行历史、脚本模板、定时任务、文件上传
 *
 * 2026-05-19: 从 orion-visor-ui 批量执行模块迁移至 CMDB
 * 2026-05-20: 新增定时任务、文件上传 Tab
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  type TableProps,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Select,
  Modal,
  message,
  Tabs,
  Descriptions,
  Statistic,
  Row,
  Col,
  Popconfirm,
  Drawer,
  Tooltip,
  Switch,
  Upload,
  Progress,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  UploadOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import { getHosts, type HostInfo } from '@/api/cmdb';
import {
  type CronJob,
  type UploadTask,
  type ScriptTemplate as ScriptTemplateType,
} from '@/api/visor-exec';
import { colors } from '@/tokens';

const { Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

interface ExecRecord {
  id: string;
  command: string;
  hosts: string[];
  hostnames: string[];
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  output: string;
  errorOutput: string;
  startTime: string;
  endTime?: string;
  operator: string;
}

// Re-export ScriptTemplate type from API client (adds updatedAt field)
type ScriptTemplate = ScriptTemplateType;

// ============================================================================
// Mock Data
// ============================================================================

const mockExecRecords: ExecRecord[] = [
  {
    id: 'exec-001',
    command: 'df -h',
    hosts: ['host-1', 'host-2', 'host-3'],
    hostnames: ['prod-web-01', 'prod-web-02', 'prod-api-01'],
    status: 'success',
    output: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   45G   55G  45% /',
    errorOutput: '',
    startTime: '2026-05-19 10:30:00',
    endTime: '2026-05-19 10:30:05',
    operator: 'admin',
  },
  {
    id: 'exec-002',
    command: 'systemctl status nginx',
    hosts: ['host-1'],
    hostnames: ['prod-web-01'],
    status: 'success',
    output: '● nginx.service - A high performance web server\n   Active: active (running) since Mon 2026-05-19 08:00:00 UTC',
    errorOutput: '',
    startTime: '2026-05-19 11:00:00',
    endTime: '2026-05-19 11:00:02',
    operator: 'admin',
  },
  {
    id: 'exec-003',
    command: 'tail -n 100 /var/log/syslog',
    hosts: ['host-2', 'host-3'],
    hostnames: ['prod-web-02', 'prod-api-01'],
    status: 'partial',
    output: 'May 19 11:05:01 prod-web-02 systemd[1]: Started Session 123 of user root.',
    errorOutput: 'tail: cannot open "/var/log/syslog" for reading: Permission denied',
    startTime: '2026-05-19 11:05:00',
    operator: 'operator',
  },
];

const mockTemplates: ScriptTemplate[] = [
  {
    id: 'tpl-001',
    name: '检查磁盘空间',
    description: '查看所有挂载点磁盘使用情况',
    content: 'df -h',
    category: '系统检查',
    createdAt: '2026-05-15',
  },
  {
    id: 'tpl-002',
    name: '检查 Nginx 状态',
    description: '查看 Nginx 服务运行状态',
    content: 'systemctl status nginx',
    category: '服务检查',
    createdAt: '2026-05-15',
  },
  {
    id: 'tpl-003',
    name: '清理日志',
    description: '清理 7 天前的日志文件',
    content: 'find /var/log -name "*.log" -mtime +7 -delete',
    category: '系统维护',
    createdAt: '2026-05-16',
  },
  {
    id: 'tpl-004',
    name: '查看内存使用',
    description: '查看系统内存使用情况',
    content: 'free -h',
    category: '系统检查',
    createdAt: '2026-05-17',
  },
];

const mockCronJobs: CronJob[] = [
  {
    id: 'cron-001',
    name: '每日磁盘检查',
    command: 'df -h && echo "Disk check completed"',
    hostIds: ['host-1', 'host-2'],
    hostnames: ['prod-web-01', 'prod-web-02'],
    cronExpression: '0 8 * * *',
    enabled: true,
    lastRunAt: '2026-05-19 08:00:00',
    nextRunAt: '2026-05-20 08:00:00',
    createdAt: '2026-05-10',
  },
  {
    id: 'cron-002',
    name: '每周日志清理',
    command: 'find /var/log -name "*.log" -mtime +7 -delete',
    hostIds: ['host-1', 'host-2', 'host-3'],
    hostnames: ['prod-web-01', 'prod-web-02', 'prod-api-01'],
    cronExpression: '0 2 * * 0',
    enabled: true,
    lastRunAt: '2026-05-18 02:00:00',
    nextRunAt: '2026-05-25 02:00:00',
    createdAt: '2026-05-05',
  },
  {
    id: 'cron-003',
    name: '健康检查',
    command: 'systemctl is-active nginx && echo "OK" || echo "FAIL"',
    hostIds: ['host-1'],
    hostnames: ['prod-web-01'],
    cronExpression: '*/5 * * * *',
    enabled: false,
    lastRunAt: '2026-05-15 10:00:00',
    createdAt: '2026-05-01',
  },
];

const mockUploadTasks: UploadTask[] = [
  {
    id: 'upload-001',
    fileName: 'config.yaml',
    fileSize: 2457,
    hostIds: ['host-1', 'host-2'],
    hostnames: ['prod-web-01', 'prod-web-02'],
    targetPath: '/etc/app/',
    status: 'success',
    progress: 100,
    createdAt: '2026-05-19 14:30:00',
  },
  {
    id: 'upload-002',
    fileName: 'deploy.sh',
    fileSize: 1024,
    hostIds: ['host-3'],
    hostnames: ['prod-api-01'],
    targetPath: '/opt/scripts/',
    status: 'running',
    progress: 45,
    createdAt: '2026-05-19 15:00:00',
  },
];

// ============================================================================
// Status Maps
// ============================================================================

const statusColorMap: Record<ExecRecord['status'], string> = {
  pending: 'blue',
  running: 'orange',
  success: 'green',
  failed: 'red',
  partial: 'orange',
};

const statusLabelMap: Record<ExecRecord['status'], string> = {
  pending: '等待中',
  running: '执行中',
  success: '成功',
  failed: '失败',
  partial: '部分成功',
};

// ============================================================================
// Command Execution Tab
// ============================================================================

const CommandExecTab: React.FC = () => {
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [execRecords, setExecRecords] = useState<ExecRecord[]>(mockExecRecords);
  const [submitting, setSubmitting] = useState(false);
  const [viewingResult, setViewingResult] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExecRecord | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => setHosts((res.data as any).data || []))
      .catch(() => setHosts([]));
  }, []);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const newRecord: ExecRecord = {
        id: `exec-${Date.now()}`,
        command: values.command,
        hosts: values.hosts,
        hostnames: values.hosts.map((id: string) => hosts.find((h) => h.ci_id === id)?.hostname || id),
        status: 'success',
        output: `Command executed successfully on ${values.hosts.length} host(s).\n\n$ ${values.command}\n(output placeholder)`,
        errorOutput: '',
        startTime: new Date().toLocaleString(),
        operator: 'admin',
      };
      setExecRecords((prev) => [newRecord, ...prev]);
      message.success(`命令已提交到 ${values.hosts.length} 台主机`);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`执行失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableProps<ExecRecord>['columns'] = [
    {
      title: '执行ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v.slice(0, 12)}</Text>,
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      ellipsis: true,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '目标主机',
      dataIndex: 'hostnames',
      key: 'hostnames',
      width: 200,
      render: (v: string[]) => (
        <Space wrap>
          {v.slice(0, 2).map((name, i) => (
            <Tag key={i} icon={<CloudServerOutlined />}>{name}</Tag>
          ))}
          {v.length > 2 && <Tag>+{v.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: ExecRecord['status']) => (
        <Tag color={statusColorMap[v]}>{statusLabelMap[v]}</Tag>
      ),
    },
    {
      title: '执行时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 170,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: ExecRecord) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedRecord(record);
            setViewingResult(true);
          }}
        >
          查看结果
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Card title="执行命令" size="small" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="hosts"
            label="目标主机"
            rules={[{ required: true, message: '请选择目标主机' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择主机（可多选）..."
              maxTagCount="responsive"
              options={hosts
                .filter((h) => h.status === 'running')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.ci_id }))}
            />
          </Form.Item>
          <Form.Item
            name="command"
            label="命令"
            rules={[{ required: true, message: '请输入要执行的命令' }]}
          >
            <TextArea
              rows={4}
              placeholder="$ 输入要执行的命令，如: df -h"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={submitting}
            >
              执行命令
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => setExecRecords(mockExecRecords)}>
          刷新
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={execRecords}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10 }}
      />

      <Drawer
        title="执行结果"
        placement="right"
        width={700}
        open={viewingResult}
        onClose={() => {
          setViewingResult(false);
          setSelectedRecord(null);
        }}
      >
        {selectedRecord && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="执行ID">{selectedRecord.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedRecord.status]}>
                  {statusLabelMap[selectedRecord.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标主机" span={2}>
                <Space wrap>
                  {selectedRecord.hostnames.map((name, i) => (
                    <Tag key={i}>{name}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="命令" span={2}>
                <Text code>{selectedRecord.command}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{selectedRecord.startTime}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{selectedRecord.endTime || '-'}</Descriptions.Item>
              <Descriptions.Item label="操作人">{selectedRecord.operator}</Descriptions.Item>
            </Descriptions>

            {selectedRecord.output && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>标准输出:</Text>
                <pre style={{ background: colors.neutral[50], padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 300, overflow: 'auto', marginTop: 8 }}>
                  {selectedRecord.output}
                </pre>
              </div>
            )}
            {selectedRecord.errorOutput && (
              <div>
                <Text strong type="danger">标准错误:</Text>
                <pre style={{ background: '#fff2f0', padding: 12, borderRadius: 6, fontSize: 12, maxHeight: 300, overflow: 'auto', marginTop: 8 }}>
                  {selectedRecord.errorOutput}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

// ============================================================================
// Script Template Tab
// ============================================================================

const ScriptTemplateTab: React.FC = () => {
  const [templates, setTemplates] = useState<ScriptTemplate[]>(mockTemplates);
  const [createVisible, setCreateVisible] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const newTpl: ScriptTemplate = {
        id: `tpl-${Date.now()}`,
        name: values.name,
        description: values.description || '',
        content: values.content,
        category: values.category || '自定义',
        createdAt: new Date().toISOString().split('T')[0],
      };
      setTemplates((prev) => [newTpl, ...prev]);
      message.success('模板创建成功');
      setCreateVisible(false);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    }
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    message.success('模板已删除');
  };

  const handleCopy = (tpl: ScriptTemplate) => {
    navigator.clipboard?.writeText(tpl.content);
    message.success('脚本内容已复制到剪贴板');
  };

  const handleUse = (tpl: ScriptTemplate) => {
    message.info(`已选择模板: ${tpl.name}`);
  };

  const columns: TableProps<ScriptTemplate>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: ScriptTemplate) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleUse(record)}>使用</Button>
          <Tooltip title="复制脚本内容">
            <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record)} />
          </Tooltip>
          <Popconfirm title="确认删除此模板？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text type="secondary">预定义脚本模板，快速选择常用命令</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
          新建模板
        </Button>
      </div>

      <Table columns={columns} dataSource={templates} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />

      <Modal title="新建脚本模板" open={createVisible} onCancel={() => setCreateVisible(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="例如：检查磁盘空间" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="模板用途描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="类别" name="category" initialValue="自定义">
                <Select
                  options={[
                    { label: '系统检查', value: '系统检查' },
                    { label: '服务检查', value: '服务检查' },
                    { label: '系统维护', value: '系统维护' },
                    { label: '自定义', value: '自定义' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="脚本内容" name="content" rules={[{ required: true, message: '请输入脚本内容' }]}>
            <TextArea rows={8} placeholder="# 输入命令或脚本内容" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Cron Job Tab
// ============================================================================

const CronJobTab: React.FC = () => {
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>(mockCronJobs);
  const [createVisible, setCreateVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => setHosts((res.data as any).data || []))
      .catch(() => setHosts([]));
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const newJob: CronJob = {
        id: `cron-${Date.now()}`,
        name: values.name,
        command: values.command,
        hostIds: values.hosts,
        hostnames: values.hosts.map((id: string) => id),
        cronExpression: values.cron,
        enabled: values.enabled ?? true,
        createdAt: new Date().toISOString().split('T')[0],
      };
      setCronJobs((prev) => [newJob, ...prev]);
      message.success('定时任务创建成功');
      setCreateVisible(false);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    }
  };

  const handleDelete = (id: string) => {
    setCronJobs((prev) => prev.filter((j) => j.id !== id));
    message.success('定时任务已删除');
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setCronJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled } : j)));
    message.success(enabled ? '任务已启用' : '任务已禁用');
  };

  const handleRunNow = (id: string) => {
    message.success(`任务 ${id} 已触发执行`);
  };

  const columns: TableProps<CronJob>['columns'] = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (v: string) => (
        <Space>
          <ScheduleOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      ellipsis: true,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v.slice(0, 50)}{v.length > 50 ? '...' : ''}</Text>,
    },
    {
      title: '目标主机',
      dataIndex: 'hostnames',
      key: 'hostnames',
      width: 180,
      render: (v: string[]) => (
        <Space wrap>
          {v.slice(0, 2).map((name, i) => (
            <Tag key={i} icon={<CloudServerOutlined />}>{name}</Tag>
          ))}
          {v.length > 2 && <Tag>+{v.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      width: 140,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '下次执行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 160,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean, record: CronJob) => (
        <Switch size="small" checked={v} onChange={(checked) => handleToggle(record.id, checked)} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: CronJob) => (
        <Space size="small">
          <Tooltip title="立即执行">
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunNow(record.id)} />
          </Tooltip>
          <Popconfirm title="确认删除此任务？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text type="secondary">定时任务管理，支持 Cron 表达式配置</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
          新建任务
        </Button>
      </div>

      <Table columns={columns} dataSource={cronJobs} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />

      <Modal title="新建定时任务" open={createVisible} onCancel={() => setCreateVisible(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="任务名称" name="name" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="例如：每日磁盘检查" />
          </Form.Item>
          <Form.Item label="命令" name="command" rules={[{ required: true, message: '请输入执行命令' }]}>
            <TextArea rows={3} placeholder="输入要执行的命令" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item label="目标主机" name="hosts" rules={[{ required: true, message: '请选择目标主机' }]}>
            <Select
              mode="multiple"
              placeholder="选择主机..."
              options={hosts
                .filter((h) => h.status === 'running')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.ci_id }))}
            />
          </Form.Item>
          <Form.Item label="Cron 表达式" name="cron" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
            <Input placeholder="例如: 0 8 * * * (每天 8:00)" />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// File Upload Tab
// ============================================================================

const FileUploadTab: React.FC = () => {
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>(mockUploadTasks);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [targetPath, setTargetPath] = useState('/tmp');

  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => setHosts((res.data as any).data || []))
      .catch(() => setHosts([]));
  }, []);

  const handleUpload = (file: File) => {
    const newTask: UploadTask = {
      id: `upload-${Date.now()}`,
      fileName: file.name,
      fileSize: file.size,
      hostIds: selectedHosts,
      hostnames: selectedHosts.map((id) => hosts.find((h) => h.ci_id === id)?.hostname || id),
      targetPath,
      status: 'running',
      progress: 0,
      createdAt: new Date().toLocaleString(),
    };
    setUploadTasks((prev) => [newTask, ...prev]);
    message.success(`文件 ${file.name} 已添加到上传队列`);
    return false; // 阻止默认上传行为
  };

  const handleCancel = (id: string) => {
    setUploadTasks((prev) => prev.filter((t) => t.id !== id));
    message.info('上传任务已取消');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const columns: TableProps<UploadTask>['columns'] = [
    {
      title: '文件名',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      width: 100,
      render: (v: number) => <Text code>{formatFileSize(v)}</Text>,
    },
    {
      title: '目标主机',
      dataIndex: 'hostnames',
      key: 'hostnames',
      width: 200,
      render: (v: string[]) => (
        <Space wrap>
          {v.slice(0, 2).map((name, i) => (
            <Tag key={i} icon={<CloudServerOutlined />}>{name}</Tag>
          ))}
          {v.length > 2 && <Tag>+{v.length - 2}</Tag>}
        </Space>
      ),
    },
    {
      title: '目标路径',
      dataIndex: 'targetPath',
      key: 'targetPath',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (v: number, record: UploadTask) => (
        <Progress
          percent={v}
          size="small"
          status={record.status === 'failed' ? 'exception' : record.status === 'success' ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: UploadTask['status']) => {
        const colorMap: Record<string, string> = { pending: 'blue', running: 'orange', success: 'green', failed: 'red', partial: 'orange' };
        const labelMap: Record<string, string> = { pending: '等待中', running: '上传中', success: '成功', failed: '失败', partial: '部分成功' };
        return <Tag color={colorMap[v]}>{labelMap[v]}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: UploadTask) =>
        record.status === 'running' || record.status === 'pending' ? (
          <Popconfirm title="取消此上传任务？" onConfirm={() => handleCancel(record.id)}>
            <Button type="link" size="small" danger icon={<PauseCircleOutlined />}>取消</Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <div>
      {/* Upload Form */}
      <Card title="文件上传" size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space>
            <Text>目标主机：</Text>
            <Select
              mode="multiple"
              style={{ width: 300 }}
              placeholder="选择目标主机..."
              value={selectedHosts}
              onChange={setSelectedHosts}
              options={hosts
                .filter((h) => h.status === 'running')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.ci_id }))}
            />
          </Space>
          <Space>
            <Text>目标路径：</Text>
            <Input style={{ width: 300 }} value={targetPath} onChange={(e) => setTargetPath(e.target.value)} placeholder="/tmp" />
          </Space>
          <Upload.Dragger
            multiple
            beforeUpload={handleUpload}
            maxCount={10}
            showUploadList={false}
          >
            <p style={{ fontSize: 16 }}>
              <UploadOutlined style={{ fontSize: 24, color: colors.primary[500] }} />
            </p>
            <Text type="secondary">点击或拖拽文件到此区域上传</Text>
          </Upload.Dragger>
        </Space>
      </Card>

      {/* Upload Tasks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text strong>上传任务列表</Text>
        <Button icon={<ReloadOutlined />} onClick={() => setUploadTasks(mockUploadTasks)}>刷新</Button>
      </div>
      <Table columns={columns} dataSource={uploadTasks} rowKey="id" size="middle" pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Main BatchExecPage
// ============================================================================

const BatchExecPage: React.FC = () => {
  const execStats = {
    total: mockExecRecords.length,
    success: mockExecRecords.filter((r) => r.status === 'success').length,
    partial: mockExecRecords.filter((r) => r.status === 'partial').length,
    failed: mockExecRecords.filter((r) => r.status === 'failed').length,
  };

  const tabItems = [
    {
      key: 'exec',
      label: (
        <span>
          <PlayCircleOutlined /> 命令执行
        </span>
      ),
      children: <CommandExecTab />,
    },
    {
      key: 'templates',
      label: (
        <span>
          <FileTextOutlined /> 脚本模板
        </span>
      ),
      children: <ScriptTemplateTab />,
    },
    {
      key: 'cron',
      label: (
        <span>
          <ScheduleOutlined /> 定时任务
        </span>
      ),
      children: <CronJobTab />,
    },
    {
      key: 'upload',
      label: (
        <span>
          <UploadOutlined /> 文件上传
        </span>
      ),
      children: <FileUploadTab />,
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="执行总数" value={execStats.total} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="成功" value={execStats.success} valueStyle={{ color: colors.success[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="部分成功" value={execStats.partial} valueStyle={{ color: colors.warning[500] }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="失败" value={execStats.failed} valueStyle={{ color: colors.error[500] }} />
          </Card>
        </Col>
      </Row>

      <Tabs defaultActiveKey="exec" items={tabItems} size="large" />
    </div>
  );
};

export default BatchExecPage;
