/**
 * Batch Command Execution for CMDB
 * 批量命令执行、执行历史、脚本模板、定时任务、文件上传
 *
 * 2026-05-19: 从 orion-visor-ui 批量执行模块迁移至 CMDB
 * 2026-05-20: 新增定时任务、文件上传 Tab
 * 2026-09-02: 提取列定义至 BatchExecColumns.tsx, 配置至 BatchExecConfig.tsx (P2-9)
 */
import { useState, useEffect } from 'react';
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
  Drawer,
  Switch,
  Upload,
  Empty,
} from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ScheduleOutlined,
  UploadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { getHosts, type HostInfo } from '@/api/cmdb';
import {
  type CronJob,
  type UploadTask,
  type ScriptTemplate as ScriptTemplateType,
  executeCommand,
  listCommandLogs,
  listTemplates,
  createTemplate,
  deleteTemplate,
  listCronJobs,
  createCronJob,
  deleteCronJob,
  toggleCronJob,
  runCronJobNow,
  uploadFile,
  listUploadTasks,
  cancelUploadTask,
} from '@/api/visor-exec';
import { spacing, colors } from '@/tokens';
import {
  type ExecRecord,
  buildExecColumns,
  buildTemplateColumns,
  buildCronJobColumns,
  buildUploadColumns,
} from './BatchExecColumns';
import {
  EXEC_STATUS_COLOR_MAP,
  EXEC_STATUS_LABEL_MAP,
  TEMPLATE_CATEGORY_OPTIONS,
  BATCH_EXEC_TAB_KEYS,
  renderStatsRow,
} from './BatchExecConfig';

const { Text } = Typography;
const { TextArea } = Input;

// Re-export ScriptTemplate type from API client (adds updatedAt field)
type ScriptTemplate = ScriptTemplateType;

// ============================================================================
// Command Execution Tab
// ============================================================================

const CommandExecTab: React.FC<{
  pendingContent?: string | null;
  pendingName?: string | null;
  onContentApplied?: () => void;
}> = ({ pendingContent, pendingName, onContentApplied }) => {
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [execRecords, setExecRecords] = useState<ExecRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewingResult, setViewingResult] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExecRecord | null>(null);
  const [form] = Form.useForm();

  const loadRecords = () => {
    setLoading(true);
    listCommandLogs(1, 50)
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        const items = (data?.items ?? []) as ExecRecord[];
        setExecRecords(items);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载执行记录失败：${msg}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => setHosts(res.data ?? []))
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载主机列表失败：${msg}`);
        setHosts([]);
      });
    loadRecords();
  }, []);

  // 应用从脚本模板 Tab 加载的内容
  useEffect(() => {
    if (pendingContent) {
      form.setFieldsValue({ command: pendingContent });
      message.success(`已应用模板「${pendingName || '未知'}」到命令表单`);
      onContentApplied?.();
    }
  }, [pendingContent, pendingName, form, onContentApplied]);

  const handleExecute = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const res = await executeCommand({
        command: values.command,
        hostIds: values.hosts,
      });
      const result = res.data as ExecRecord;
      setExecRecords((prev) => [result, ...prev]);
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

  const execColumns: TableProps<ExecRecord>['columns'] = buildExecColumns({
    onViewResult: (record) => {
      setSelectedRecord(record);
      setViewingResult(true);
    },
  });

  return (
    <div>
      <Card title="执行命令" size="small" style={{ marginBottom: spacing.md }}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing.md }}>
        <Button icon={<ReloadOutlined />} onClick={loadRecords} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={execColumns}
        dataSource={execRecords}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无执行记录，请先执行命令" /> }}
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
            <Descriptions bordered size="small" column={2} style={{ marginBottom: spacing.md }}>
              <Descriptions.Item label="执行ID">{selectedRecord.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={EXEC_STATUS_COLOR_MAP[selectedRecord.status]}>
                  {EXEC_STATUS_LABEL_MAP[selectedRecord.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="目标主机" span={2}>
                <Space wrap>
                  {selectedRecord.hostnames.map((name, i) => (
                    <Tag key={String(i)}>{name}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="命令" span={2}>
                <Text code>{selectedRecord.command}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{selectedRecord.startTime}</Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {selectedRecord.endTime || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="操作人">{selectedRecord.operator}</Descriptions.Item>
            </Descriptions>

            {selectedRecord.output && (
              <div style={{ marginBottom: spacing.md }}>
                <Text strong>标准输出:</Text>
                <pre
                  style={{
                    background: colors.neutral[50],
                    padding: spacing[3],
                    borderRadius: 6,
                    fontSize: 12,
                    maxHeight: 300,
                    overflow: 'auto',
                    marginTop: spacing.sm,
                  }}
                >
                  {selectedRecord.output}
                </pre>
              </div>
            )}
            {selectedRecord.errorOutput && (
              <div>
                <Text strong type="danger">
                  标准错误:
                </Text>
                <pre
                  style={{
                    background: colors.error[50],
                    padding: spacing[3],
                    borderRadius: 6,
                    fontSize: 12,
                    maxHeight: 300,
                    overflow: 'auto',
                    marginTop: spacing.sm,
                  }}
                >
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

const ScriptTemplateTab: React.FC<{ onUseTemplate?: (tpl: ScriptTemplate) => void }> = ({
  onUseTemplate,
}) => {
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadTemplates = () => {
    setLoading(true);
    listTemplates()
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        setTemplates((data?.items ?? []) as ScriptTemplate[]);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载模板列表失败：${msg}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await createTemplate({
        name: values.name,
        description: values.description || '',
        content: values.content,
        category: values.category || '自定义',
      });
      const newTpl = res.data as ScriptTemplate;
      setTemplates((prev) => [newTpl, ...prev]);
      message.success('模板创建成功');
      setCreateVisible(false);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      message.success('模板已删除');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`删除失败：${msg}`);
    }
  };

  const handleCopy = (tpl: ScriptTemplate) => {
    navigator.clipboard?.writeText(tpl.content);
    message.success('脚本内容已复制到剪贴板');
  };

  const handleUse = (tpl: ScriptTemplate) => {
    if (onUseTemplate) {
      onUseTemplate(tpl);
    } else {
      message.info(`已选择模板: ${tpl.name}`);
    }
  };

  const templateColumns: TableProps<ScriptTemplate>['columns'] = buildTemplateColumns({
    onUse: handleUse,
    onCopy: handleCopy,
    onDelete: handleDelete,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text type="secondary">预定义脚本模板，快速选择常用命令</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
          新建模板
        </Button>
      </div>

      <Table
        columns={templateColumns}
        dataSource={templates}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无脚本模板，请创建第一个模板" /> }}
      />

      <Modal
        title="新建脚本模板"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：检查磁盘空间" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="模板用途描述" />
          </Form.Item>
          <Form.Item label="类别" name="category" initialValue="自定义">
            <Select options={TEMPLATE_CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="脚本内容"
            name="content"
            rules={[{ required: true, message: '请输入脚本内容' }]}
          >
            <TextArea
              rows={8}
              placeholder="# 输入命令或脚本内容"
              style={{ fontFamily: 'monospace' }}
            />
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
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadCronJobs = () => {
    setLoading(true);
    listCronJobs()
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        setCronJobs((data?.items ?? []) as CronJob[]);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载定时任务失败：${msg}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => setHosts(res.data ?? []))
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载主机列表失败：${msg}`);
        setHosts([]);
      });
    loadCronJobs();
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await createCronJob({
        name: values.name,
        command: values.command,
        hostIds: values.hosts,
        cronExpression: values.cron,
        enabled: values.enabled ?? true,
      });
      const newJob = res.data as CronJob;
      setCronJobs((prev) => [newJob, ...prev]);
      message.success('定时任务创建成功');
      setCreateVisible(false);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id);
      setCronJobs((prev) => prev.filter((j) => j.id !== id));
      message.success('定时任务已删除');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`删除失败：${msg}`);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleCronJob(id, enabled);
      setCronJobs((prev) => prev.map((j) => (j.id === id ? { ...j, enabled } : j)));
      message.success(enabled ? '任务已启用' : '任务已禁用');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`操作失败：${msg}`);
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await runCronJobNow(id);
      message.success('任务已触发执行');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`触发失败：${msg}`);
    }
  };

  const cronJobColumns: TableProps<CronJob>['columns'] = buildCronJobColumns({
    onToggle: handleToggle,
    onRunNow: handleRunNow,
    onDelete: handleDelete,
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text type="secondary">定时任务管理，支持 Cron 表达式配置</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
          新建任务
        </Button>
      </div>

      <Table
        columns={cronJobColumns}
        dataSource={cronJobs}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无定时任务，请创建第一个任务" /> }}
      />

      <Modal
        title="新建定时任务"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="任务名称"
            name="name"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：每日磁盘检查" />
          </Form.Item>
          <Form.Item
            label="命令"
            name="command"
            rules={[{ required: true, message: '请输入执行命令' }]}
          >
            <TextArea rows={3} placeholder="输入要执行的命令" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item
            label="目标主机"
            name="hosts"
            rules={[{ required: true, message: '请选择目标主机' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择主机..."
              options={hosts
                .filter((h) => h.status === 'running')
                .map((h) => ({ label: `${h.hostname} (${h.ip})`, value: h.ci_id }))}
            />
          </Form.Item>
          <Form.Item
            label="Cron 表达式"
            name="cron"
            rules={[{ required: true, message: '请输入 Cron 表达式' }]}
          >
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
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [targetPath, setTargetPath] = useState('/tmp');

  const loadUploadTasks = () => {
    setLoading(true);
    listUploadTasks()
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        setUploadTasks((data?.items ?? []) as UploadTask[]);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载上传任务失败：${msg}`);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getHosts({ pageSize: 100 })
      .then((res) => setHosts(res.data ?? []))
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : '未知错误';
        message.error(`加载主机列表失败：${msg}`);
        setHosts([]);
      });
    loadUploadTasks();
  }, []);

  const handleUpload = async (file: File) => {
    if (selectedHosts.length === 0) {
      message.warning('请先选择目标主机');
      return false;
    }
    try {
      const res = await uploadFile(file, selectedHosts, targetPath);
      const newTask = res.data as UploadTask;
      setUploadTasks((prev) => [newTask, ...prev]);
      message.success(`文件 ${file.name} 已开始上传`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`上传失败：${msg}`);
    }
    return false; // 阻止默认上传行为
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelUploadTask(id);
      setUploadTasks((prev) => prev.filter((t) => t.id !== id));
      message.info('上传任务已取消');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      message.error(`取消失败：${msg}`);
    }
  };

  const uploadColumns: TableProps<UploadTask>['columns'] = buildUploadColumns({
    onCancel: handleCancel,
  });

  return (
    <div>
      {/* Upload Form */}
      <Card title="文件上传" size="small" style={{ marginBottom: spacing.md }}>
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
            <Input
              style={{ width: 300 }}
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/tmp"
            />
          </Space>
          <Upload.Dragger multiple beforeUpload={handleUpload} maxCount={10} showUploadList={false}>
            <p style={{ fontSize: 16 }}>
              <UploadOutlined style={{ fontSize: 24, color: colors.primary[500] }} />
            </p>
            <Text type="secondary">点击或拖拽文件到此区域上传</Text>
          </Upload.Dragger>
        </Space>
      </Card>

      {/* Upload Tasks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text strong>上传任务列表</Text>
        <Button icon={<ReloadOutlined />} onClick={loadUploadTasks} loading={loading}>
          刷新
        </Button>
      </div>
      <Table
        columns={uploadColumns}
        dataSource={uploadTasks}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: <Empty description="暂无上传任务" /> }}
      />
    </div>
  );
};

// ============================================================================
// Main BatchExecPage
// ============================================================================

const BatchExecPage: React.FC = () => {
  const [execStats, setExecStats] = useState({ total: 0, success: 0, partial: 0, failed: 0 });
  // 跨 Tab 通信：脚本模板"使用"按钮填充命令表单
  const [pendingTemplateContent, setPendingTemplateContent] = useState<string | null>(null);
  const [pendingTemplateName, setPendingTemplateName] = useState<string | null>(null);

  const handleUseTemplate = (tpl: ScriptTemplate) => {
    setPendingTemplateContent(tpl.content);
    setPendingTemplateName(tpl.name);
    message.success(`已加载模板「${tpl.name}」到命令表单，请切换到"命令执行"Tab`);
  };

  useEffect(() => {
    listCommandLogs(1, 100)
      .then((res) => {
        const data = res.data as Record<string, unknown> | undefined;
        const items = (data?.items ?? []) as ExecRecord[];
        setExecStats({
          total: items.length,
          success: items.filter((r) => r.status === 'success').length,
          partial: items.filter((r) => r.status === 'partial').length,
          failed: items.filter((r) => r.status === 'failed').length,
        });
      })
      .catch(() => {});
  }, []);

  const tabItems = [
    {
      key: BATCH_EXEC_TAB_KEYS.exec,
      label: (
        <span>
          <PlayCircleOutlined /> 命令执行
        </span>
      ),
      children: (
        <CommandExecTab
          pendingContent={pendingTemplateContent}
          pendingName={pendingTemplateName}
          onContentApplied={() => setPendingTemplateContent(null)}
        />
      ),
    },
    {
      key: BATCH_EXEC_TAB_KEYS.templates,
      label: (
        <span>
          <FileTextOutlined /> 脚本模板
        </span>
      ),
      children: <ScriptTemplateTab onUseTemplate={handleUseTemplate} />,
    },
    {
      key: BATCH_EXEC_TAB_KEYS.cron,
      label: (
        <span>
          <ScheduleOutlined /> 定时任务
        </span>
      ),
      children: <CronJobTab />,
    },
    {
      key: BATCH_EXEC_TAB_KEYS.upload,
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
      {renderStatsRow(execStats)}

      <Tabs defaultActiveKey="exec" items={tabItems} size="large" />
    </div>
  );
};

export default BatchExecPage;
