/**
 * ExecuteAgentModal - 执行 Agent 对话框
 * 抽取自 index.tsx (P2-9 Phase 207)
 */
import { Modal, Form, Input, Button, Card } from 'antd';
import type { FormInstance } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { AgentInfo, AgentExecutionResult } from '@/api/ai-agents';
import { colors, spacing, themeVars } from '@/tokens';

interface Props {
  open: boolean;
  form: FormInstance;
  selectedAgent: AgentInfo | null;
  executing: boolean;
  executionResult: AgentExecutionResult | null;
  onSubmit: () => void;
  onClose: () => void;
}

export const ExecuteAgentModal = ({
  open,
  form,
  selectedAgent,
  executing,
  executionResult,
  onSubmit,
  onClose,
}: Props) => (
  <Modal
    title={
      <span>
        <PlayCircleOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        执行 Agent: {selectedAgent?.config?.name || selectedAgent?.id}
      </span>
    }
    open={open}
    onCancel={onClose}
    footer={null}
    width={600}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        label="输入参数 (JSON)"
        name="input"
        rules={[{ required: true, message: '请输入执行参数' }]}
      >
        <Input.TextArea
          rows={6}
          placeholder='{"key": "value"}'
          style={{ fontFamily: 'monospace' }}
        />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={onSubmit}
          loading={executing}
          block
        >
          {executing ? '执行中...' : '执行 Agent'}
        </Button>
      </Form.Item>
    </Form>

    {executionResult && (
      <Card
        size="small"
        title="执行结果"
        style={{
          marginTop: spacing.md,
          backgroundColor: executionResult.success ? themeVars.bgSecondary : colors.error[50],
          borderColor: executionResult.success ? colors.success[500] : colors.error[500],
        }}
      >
        <pre
          style={{
            margin: 0,
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(executionResult, null, 2)}
        </pre>
      </Card>
    )}
  </Modal>
);
