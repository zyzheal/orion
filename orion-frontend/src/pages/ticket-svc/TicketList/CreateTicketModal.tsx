/**
 * CreateTicketModal
 * - Modal form for creating new tickets
 * - Fields: title, category, priority, description, tags, source, related IDs
 * - Form validation with clear error messages
 * - Duplicate detection preview
 * - Submit button with loading state
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Modal, Form, Input, Select, Radio, Typography, message, Space } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { createTicket, type CreateTicketPayload } from '@/api/ticketing';

const { Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

export interface CreateTicketFormValues {
  title: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  tags?: string[];
  source: 'manual' | 'alert' | 'incident' | 'api';
  alertId?: string;
  incidentId?: string;
}

export interface CreateTicketModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

// ============================================================================
// Category options
// ============================================================================

const categoryOptions = [
  { label: '基础设施', value: 'infrastructure' },
  { label: '应用', value: 'application' },
  { label: '数据库', value: 'database' },
  { label: '网络', value: 'network' },
  { label: '安全', value: 'security' },
  { label: '部署', value: 'deployment' },
  { label: '流水线', value: 'pipeline' },
  { label: '性能', value: 'performance' },
  { label: '成本', value: 'cost' },
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
// Duplicate detection
// ============================================================================

/**
 * Simple duplicate detection based on title keywords.
 * Checks against a small set of known recurring patterns.
 * In production, this would query the backend for similar tickets.
 */
const KNOWN_TICKET_PATTERNS = [
  'CPU', '数据库', 'API 网关', '磁盘空间', '部署',
  '安全漏洞', '成本', '响应延迟', 'Redis',
];

function findPotentialDuplicates(title: string): string[] {
  if (title.length < 5) return [];
  const titleLower = title.toLowerCase();
  const warnings: string[] = [];

  for (const pattern of KNOWN_TICKET_PATTERNS) {
    if (titleLower.includes(pattern.toLowerCase())) {
      warnings.push(`标题包含常见模式"${pattern}"，建议先搜索类似工单`);
    }
  }

  return warnings;
}

// ============================================================================
// Component
// ============================================================================

const CreateTicketModal: React.FC<CreateTicketModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm<CreateTicketFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  const potentialDuplicates = useMemo(() => {
    return findPotentialDuplicates(titleValue);
  }, [titleValue]);

  const source = Form.useWatch('source', form);

  const handleSubmit = useCallback(async () => {
    try {
      await form.validateFields();
      setSubmitting(true);
      const values = form.getFieldsValue() as unknown as CreateTicketPayload;
      await createTicket(values);
      message.success('工单创建成功');
      form.resetFields();
      setTitleValue('');
      onSuccess();
    } catch (error: unknown) {
      if (error instanceof Error && error.message !== 'Validation failed') {
        message.error(`创建失败：${error.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, onSuccess]);

  const handleCancel = () => {
    form.resetFields();
    setTitleValue('');
    onCancel();
  };

  return (
    <Modal
      title="创建工单"
      open={open}
      onCancel={handleCancel}
      width={640}
      okText="创建"
      cancelText="取消"
      confirmLoading={submitting}
      onOk={handleSubmit}
      okButtonProps={{
        'data-testid': 'create-ticket-submit',
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
            onChange={(e) => setTitleValue(e.target.value)}
            data-testid="create-ticket-title"
            allowClear
          />
        </Form.Item>

        {/* Duplicate detection preview */}
        {potentialDuplicates.length > 0 && (
          <div
            style={{
              background: colors.warning[50],
              border: `1px solid ${colors.warning[200]}`,
              borderRadius: 8,
              padding: spacing[3],
              marginBottom: spacing[4],
            }}
            data-testid="duplicate-preview"
          >
            <Space>
              <WarningOutlined style={{ color: colors.warning[500] }} />
              <Text strong style={{ color: colors.warning[700] }}>
                发现可能的重复工单
              </Text>
            </Space>
            <div style={{ marginTop: spacing[2] }}>
              {potentialDuplicates.map((dup, idx) => (
                <div key={idx} style={{ marginBottom: spacing[1] }}>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    <WarningOutlined /> {dup}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category and Priority row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            label="工单分类"
            name="category"
            rules={[{ required: true, message: '请选择工单分类' }]}
          >
            <Select
              placeholder="请选择分类"
              options={categoryOptions}
              data-testid="create-ticket-category"
            />
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Radio.Group data-testid="create-ticket-priority" style={{ display: 'flex', gap: 8 }}>
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                <Radio.Button
                  key={p}
                  value={p}
                  style={{
                    borderColor: priorityColors[p],
                    color: priorityColors[p],
                  }}
                  data-testid={`priority-${p}`}
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
            data-testid="create-ticket-description"
          />
        </Form.Item>

        {/* Tags */}
        <Form.Item label="标签" name="tags">
          <Select
            mode="tags"
            placeholder="输入标签后回车添加"
            style={{ width: '100%' }}
            tokenSeparators={[',']}
            data-testid="create-ticket-tags"
          />
        </Form.Item>

        {/* Source */}
        <Form.Item label="来源" name="source" rules={[{ required: true, message: '请选择来源' }]}>
          <Select
            placeholder="请选择来源"
            options={sourceOptions}
            data-testid="create-ticket-source"
          />
        </Form.Item>

        {/* Conditional fields based on source */}
        {source === 'alert' && (
          <Form.Item label="关联告警 ID" name="alertId">
            <Input
              placeholder="请输入告警 ID（如 ALT-123）"
              data-testid="create-ticket-alert-id"
              allowClear
            />
          </Form.Item>
        )}

        {source === 'incident' && (
          <Form.Item label="关联事件 ID" name="incidentId">
            <Input placeholder="请输入事件 ID" data-testid="create-ticket-incident-id" allowClear />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default CreateTicketModal;
