import { Modal, Form, Input, Select } from 'antd';

interface Props {
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  confirmLoading: boolean;
  createForm: any;
}

export function CreateModal({ open, onCancel, onOk, confirmLoading, createForm }: Props) {
  return (
    <Modal
      title="创建备份计划"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={confirmLoading}
      width={520}
      destroyOnClose
    >
      <Form form={createForm} layout="vertical">
        <Form.Item
          name="name"
          label="计划名称"
          rules={[{ required: true, message: '请输入计划名称' }]}
        >
          <Input placeholder="如: daily-db-backup" />
        </Form.Item>
        <Form.Item
          name="type"
          label="备份类型"
          rules={[{ required: true, message: '请选择备份类型' }]}
          initialValue="full"
        >
          <Select>
            <Select.Option value="full">全量备份</Select.Option>
            <Select.Option value="incremental">增量备份</Select.Option>
            <Select.Option value="differential">差异备份</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          name="retentionDays"
          label="保留天数"
          initialValue={7}
          rules={[{ required: true, message: '请输入保留天数' }]}
        >
          <Input type="number" min={1} max={365} />
        </Form.Item>
        <Form.Item name="schedule" label="Cron 调度表达式">
          <Input placeholder="如: 0 2 * * *（每天凌晨2点）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
