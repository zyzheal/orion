/**
 * EditTicketModal
 * - Modal form for editing existing tickets
 * - Pre-fills form with ticket data
 * - Calls updateTicket API on submit
 * - Same fields as CreateTicketModal
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Form, Input, Select, Radio, Typography, message, Space } from 'antd';
import { colors, spacing } from '@/tokens';
import { updateTicket, type Ticket } from '@/api/ticketing';

const { Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

export interface EditTicketFormValues {
  title: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  tags?: string[];
  source: 'manual' | 'alert' | 'incident' | 'api';
  alertId?: string;
  incidentId?: string;
}

export interface EditTicketModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  ticket: Ticket | null;
}

// ============================================================================
// Category options
// ============================================================================

const categoryOptions = [
  { label: '基础设施', value: 'infrastructure' },
  { label: '应用', value: 'application' },
  { label: '安全', value: 'security' },
  { label: '网络', value: 'network' },
  { label: '数据库', value: 'database' },
  { label: '其他', value: 'other' },
];

const sourceOptions = [
  { label: '手动创建', value: 'manual' },
  { label: '告警', value: 'alert' },
  { label: '事件', value: 'incident' },
  { label: 'API', value: 'api' },
];

const priorityColors: Record<string, string> = {
  critical: colors.error[400],
  high: colors.warning[600],
  medium: colors.primary[500],
  low: colors.neutral[500],
};

const priorityLabels: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

// ============================================================================
// Component
// ============================================================================

const EditTicketModal: React.FC<EditTicketModalProps> = ({ open, onCancel, onSuccess, ticket }) => {
  const [form] = Form.useForm<EditTicketFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill form when ticket changes
  useEffect(() => {
    if (open && ticket) {
      form.setFieldsValue({
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority as EditTicketFormValues['priority'],
        description: ticket.description,
        source: ticket.source as EditTicketFormValues['source'],
        tags: ticket.tags ? Object.keys(ticket.tags) : [],
      });
    }
  }, [open, ticket, form]);

  const source = Form.useWatch('source', form);

  const handleSubmit = useCallback(async () => {
    if (!ticket) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await updateTicket(ticket.id, {
        title: values.title,
        description: values.description,
        category: values.category as Ticket['category'],
        priority: values.priority,
        source: values.source as Ticket['source'],
        tags: values.tags?.reduce((acc: Record<string, string>, tag: string) => ({ ...acc, [tag]: tag }), {}),
      });
      message.success('工单更新成功');
      form.resetFields();
      setSubmitting(false);
      onSuccess();
    } catch (error: unknown) {
      setSubmitting(false);
      // Form validation error - no need to show additional message
    }
  }, [form, onSuccess, ticket]);

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="编辑工单"
      open={open}
      onCancel={handleCancel}
      width={640}
      okText="保存"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={handleSubmit}
      okButtonProps={{
        'data-testid': 'edit-ticket-submit',
      }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          source: 'manual',
          priority: 'medium',
        }}
        requiredMark
      >
        {/* Title */}
        <Form.Item
          label="工单标题"
          name="title"
          rules={[
            { required: true, message: '请输入工单标题' },
            { min: 5, message: '标题至少 5 个字符' },
            { max: 200, message: '标题最多 200 个字符' },
          ]}
        >
          <Input
            placeholder="请输入工单标题"
            data-testid="edit-ticket-title"
            allowClear
          />
        </Form.Item>

        {/* Category and Priority row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
          <Form.Item
            label="工单分类"
            name="category"
            rules={[{ required: true, message: '请选择工单分类' }]}
          >
            <Select
              placeholder="请选择分类"
              options={categoryOptions}
              data-testid="edit-ticket-category"
            />
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Radio.Group data-testid="edit-ticket-priority" style={{ display: 'flex', gap: spacing.sm }}>
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                <Radio.Button
                  key={p}
                  value={p}
                  style={{
                    borderColor: priorityColors[p],
                    color: priorityColors[p],
                  }}
                  data-testid={`edit-priority-${p}`}
                >
                  {priorityLabels[p]}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </div>

        {/* Description */}
        <Form.Item
          label="工单描述"
          name="description"
          rules={[
            { required: true, message: '请输入工单描述' },
            { min: 20, message: '描述至少 20 个字符' },
          ]}
        >
          <TextArea
            placeholder="请详细描述工单情况，包括现象、影响范围、紧急程度等..."
            rows={4}
            showCount
            maxLength={2000}
            data-testid="edit-ticket-description"
          />
        </Form.Item>

        {/* Tags */}
        <Form.Item label="标签" name="tags">
          <Select
            mode="tags"
            placeholder="输入标签后回车添加"
            style={{ width: '100%' }}
            tokenSeparators={[',']}
            data-testid="edit-ticket-tags"
          />
        </Form.Item>

        {/* Source */}
        <Form.Item label="来源" name="source" rules={[{ required: true, message: '请选择来源' }]}>
          <Select
            placeholder="请选择来源"
            options={sourceOptions}
            data-testid="edit-ticket-source"
          />
        </Form.Item>

        {/* Conditional fields based on source */}
        {source === 'alert' && (
          <Form.Item label="关联告警 ID" name="alertId">
            <Input
              placeholder="请输入告警 ID（如 ALT-123）"
              data-testid="edit-ticket-alert-id"
              allowClear
            />
          </Form.Item>
        )}

        {source === 'incident' && (
          <Form.Item label="关联事件 ID" name="incidentId">
            <Input placeholder="请输入事件 ID" data-testid="edit-ticket-incident-id" allowClear />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default EditTicketModal;
