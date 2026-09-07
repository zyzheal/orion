/**
 * FlowDesigner AiGenerateModal (TR-10)
 * 抽取自 index.tsx (P2-9 Phase 190)
 */
import { Button, Form, Input, Modal } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import type { FormInstance } from 'antd';

interface AiGenerateModalProps {
  form: FormInstance;
  open: boolean;
  loading: boolean;
  onSubmit: (values: { prompt: string; name?: string }) => void;
  onClose: () => void;
}

export const AiGenerateModal = ({ form, open, loading, onSubmit, onClose }: AiGenerateModalProps) => (
  <Modal
    title={
      <span>
        <ThunderboltOutlined style={{ marginRight: 8, color: colors.purple[500] }} />
        AI 生成流程
      </span>
    }
    open={open}
    onCancel={onClose}
    footer={null}
  >
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        name="prompt"
        label="描述你想要的流程"
        rules={[{ required: true, message: '请输入流程描述' }]}
      >
        <Input.TextArea
          placeholder="例如：创建一个审批流程，包含提交、审批、通知节点"
          rows={4}
        />
      </Form.Item>
      <Form.Item name="name" label="流程名称（可选）">
        <Input placeholder="留空则自动命名" />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          icon={<ThunderboltOutlined />}
          loading={loading}
          style={{ backgroundColor: colors.purple[500], borderColor: colors.purple[500] }}
        >
          AI 生成
        </Button>
      </Form.Item>
      <div style={{ fontSize: 12, color: colors.neutral[400], textAlign: 'center' }}>
        支持场景：审批 / 发布 / 通知 / 数据同步 / 定时任务
      </div>
    </Form>
  </Modal>
);
