/**
 * JobModal - 新建 / 编辑自动化作业 Modal
 * 内部管理 Form 实例，通过 useEffect 与 editingJob 状态同步
 */
import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch } from 'antd';
import type { AutoJob } from '@/api/automation';
import { JOB_TYPE_OPTIONS } from './constants';

const { TextArea } = Input;
const { Option } = Select;

export interface JobModalProps {
  open: boolean;
  editingJob: AutoJob | null;
  saving: boolean;
  onOk: (values: any) => Promise<void> | void;
  onCancel: () => void;
}

export const JobModal: React.FC<JobModalProps> = ({ open, editingJob, saving, onOk, onCancel }) => {
  const [form] = Form.useForm();

  // 每次打开 Modal 时，根据 editingJob 重置 / 填充表单
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingJob) {
      form.setFieldsValue({
        name: editingJob.name,
        description: editingJob.description,
        type: editingJob.type,
        enabled: editingJob.enabled,
        schedule: editingJob.schedule,
        tags: editingJob.tags,
        config: JSON.stringify(editingJob.config, null, 2),
      });
    } else {
      form.setFieldsValue({
        type: 'script',
        enabled: true,
        tags: [],
      });
    }
  }, [open, editingJob, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onOk(values);
  };

  return (
    <Modal
      title={editingJob ? '编辑作业' : '新建作业'}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={saving}
      width={720}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ loading: saving, disabled: saving }}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 680 }}
        initialValues={{ enabled: true, tags: [] }}
      >
        <Form.Item
          name="name"
          label="作业名称"
          rules={[{ required: true, message: '请输入作业名称' }]}
        >
          <Input placeholder="例：部署后健康检查" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea rows={2} placeholder="作业描述（可选）" />
        </Form.Item>

        <Form.Item
          name="type"
          label="作业类型"
          rules={[{ required: true, message: '请选择作业类型' }]}
        >
          <Select placeholder="选择作业类型">
            {JOB_TYPE_OPTIONS.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="enabled" label="启用" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="停用" />
        </Form.Item>

        <Form.Item
          name="schedule"
          label="调度表达式 (Cron)"
          rules={[
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                const parts = value.trim().split(/\s+/);
                if (parts.length < 5) {
                  return Promise.reject(new Error('Cron 表达式格式不正确，至少需要 5 个字段'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="例：0 2 * * *  (留空为手动触发)" />
        </Form.Item>

        <Form.Item name="tags" label="标签">
          <Select mode="tags" placeholder="输入标签后回车" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="config" label="配置 (JSON)">
          <TextArea rows={4} placeholder='{"scriptId": "script-xxx", "timeout": 300}' />
        </Form.Item>
      </Form>
    </Modal>
  );
};
