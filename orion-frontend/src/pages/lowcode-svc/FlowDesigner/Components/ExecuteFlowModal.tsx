/**
 * FlowDesigner ExecuteFlowModal
 * 抽取自 index.tsx (P2-9 Phase 190)
 */
import { Button, Form, Input, Modal } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';

interface ExecuteFlowModalProps {
  open: boolean;
  flowName: string;
  onSubmit: (values: { input?: string }) => void;
  onClose: () => void;
}

export const ExecuteFlowModal = ({ open, flowName, onSubmit, onClose }: ExecuteFlowModalProps) => (
  <Modal title={`执行流程: ${flowName}`} open={open} onCancel={onClose} footer={null}>
    <Form layout="vertical" onFinish={onSubmit}>
      <Form.Item name="input" label="输入参数 (JSON)">
        <Input.TextArea placeholder='{"key": "value"}' rows={4} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block icon={<PlayCircleOutlined />}>
          执行
        </Button>
      </Form.Item>
    </Form>
  </Modal>
);
