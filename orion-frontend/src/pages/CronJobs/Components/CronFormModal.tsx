/**
 * CronJobs Form Modal
 * 抽取自 index.tsx (P2-9 Phase 195)
 */
import { Form, Input, Modal } from 'antd';
import type { FormInstance } from 'antd';
import type { CronJob, CronJobInput } from '@/api/cron';

interface CronFormModalProps {
  form: FormInstance<CronJobInput>;
  open: boolean;
  editingJob: CronJob | null;
  submitting: boolean;
  onSubmit: (values: CronJobInput) => Promise<void>;
  onClose: () => void;
}

export const CronFormModal = ({
  form,
  open,
  editingJob,
  submitting,
  onSubmit,
  onClose,
}: CronFormModalProps) => (
  <Modal
    title={editingJob ? '编辑定时任务' : '新建定时任务'}
    open={open}
    onCancel={onClose}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    okText={editingJob ? '保存' : '创建'}
    cancelText="取消"
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
        <Input placeholder="例如：每日数据清理" />
      </Form.Item>
      <Form.Item name="schedule" label="Cron 表达式" rules={[{ required: true }]}>
        <Input placeholder="例如：0 2 * * * (每天凌晨2点)" />
      </Form.Item>
      <Form.Item name="command" label="执行命令" rules={[{ required: true }]}>
        <Input.TextArea rows={4} placeholder="输入要执行的命令或脚本" />
      </Form.Item>
    </Form>
  </Modal>
);
