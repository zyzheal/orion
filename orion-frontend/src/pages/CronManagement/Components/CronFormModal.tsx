/**
 * CronManagement Form Modal
 * 抽取自 index.tsx (P2-9 Phase 193)
 */
import { Form, Input, Modal, Switch } from 'antd';
import type { FormInstance } from 'antd';
import type { CronJob, CronJobInput } from '@/api/cron';

const { TextArea } = Input;

interface CronFormModalProps {
  form: FormInstance<CronJobInput>;
  open: boolean;
  editingJob: CronJob | null;
  onSubmit: (values: CronJobInput) => Promise<void>;
  onClose: () => void;
}

export const CronFormModal = ({ form, open, editingJob, onSubmit, onClose }: CronFormModalProps) => (
  <Modal
    title={editingJob ? '编辑定时任务' : '新建定时任务'}
    open={open}
    onCancel={onClose}
    onOk={() => form.submit()}
    width={560}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item name="name" label="名称" rules={[{ required: true }]}>
        <Input placeholder="e.g. daily-cleanup" />
      </Form.Item>
      <Form.Item name="schedule" label="Cron 表达式" rules={[{ required: true }]}>
        <Input placeholder="e.g. 0 2 * * *" />
      </Form.Item>
      <Form.Item name="command" label="命令" rules={[{ required: true }]}>
        <TextArea rows={3} placeholder="e.g. npm run cleanup -- --env=production" />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
    </Form>
  </Modal>
);
