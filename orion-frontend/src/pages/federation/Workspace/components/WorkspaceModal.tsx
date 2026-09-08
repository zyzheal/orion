/**
 * WorkspaceModal.tsx - Workspace 创建/编辑表单 Modal
 * 抽取自 index.tsx (P2-9 Phase 221)
 */
import { Form, Input, Modal, Select } from 'antd';

const { Option } = Select;

interface Props {
  editing: unknown | null;
  open: boolean;
  confirmLoading: boolean;
  form: import('antd').FormInstance<
    import('../useWorkspaceState').FormValues
  >;
  onOk: () => void | Promise<void>;
  onCancel: () => void;
}

export const WorkspaceModal = ({
  editing,
  open,
  confirmLoading,
  form,
  onOk,
  onCancel,
}: Props) => (
  <Modal
    title={editing ? '编辑工作空间' : '创建工作空间'}
    open={open}
    confirmLoading={confirmLoading}
    onCancel={onCancel}
    onOk={onOk}
    okText="保存"
    cancelText="取消"
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item
        label="空间名称"
        name="name"
        rules={[{ required: true, message: '请输入空间名称' }]}
      >
        <Input placeholder="例: production-team-a" />
      </Form.Item>
      <Form.Item label="描述" name="description">
        <Input.TextArea rows={2} placeholder="空间用途描述" />
      </Form.Item>
      <Form.Item
        label="所属集群"
        name="clusterId"
        rules={[{ required: true, message: '请选择集群' }]}
      >
        <Select placeholder="选择集群">
          <Option value="cluster-main">主集群</Option>
          <Option value="cluster-backup">备份集群</Option>
          <Option value="cluster-dev">开发集群</Option>
        </Select>
      </Form.Item>
      <Form.Item label="CPU 配额(核)" name="cpuQuota" initialValue={4}>
        <Input type="number" min={1} max={64} />
      </Form.Item>
      <Form.Item label="内存配额(GB)" name="memoryQuota" initialValue={8}>
        <Input type="number" min={1} max={256} />
      </Form.Item>
      <Form.Item label="存储配额(GB)" name="storageQuota" initialValue={100}>
        <Input type="number" min={10} max={10000} />
      </Form.Item>
    </Form>
  </Modal>
);
