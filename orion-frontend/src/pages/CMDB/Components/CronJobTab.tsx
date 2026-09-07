/**
 * CronJobTab - 定时任务 Tab
 * 抽取自 BatchExecPage.tsx (P2-9 Phase 112)
 */
import React, { useState, useEffect } from 'react';
import {
  Table,
  type TableProps,
  Button,
  Form,
  Input,
  Select,
  Switch,
  Modal,
  message,
  Empty,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getHosts, type HostInfo } from '@/api/cmdb';
import {
  type CronJob,
  listCronJobs,
  createCronJob,
  deleteCronJob,
  toggleCronJob,
  runCronJobNow,
} from '@/api/visor-exec';
import { spacing } from '@/tokens';
import { buildCronJobColumns } from '../BatchExecColumns';

const { Text } = Typography;
const { TextArea } = Input;

export const CronJobTab: React.FC = () => {
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
