/**
 * ActionPanel.tsx - Assistant 智能操作面板
 * 抽取自 Assistant/index.tsx (P2-9 Phase 66)
 */
import React from 'react';
import { Form, Input, Space, Button, Card, Tag, Typography } from 'antd';
import {
  PlayCircleOutlined,
  CloudServerOutlined,
  FunnelPlotOutlined,
} from '@ant-design/icons';
import { colors, themeVars } from '@/tokens';
import type { AssistantActionResult } from '@/api/assistant';

const { Text } = Typography;

interface ActionPanelProps {
  actionPrompt: string;
  setActionPrompt: (v: string) => void;
  actionTitle: string;
  setActionTitle: (v: string) => void;
  actionLoading: boolean;
  actionResult: AssistantActionResult | null;
  handleAction: (
    kind: 'trigger_pipeline' | 'suggest_command' | 'generate_flow',
  ) => void;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
  actionPrompt,
  setActionPrompt,
  actionTitle,
  setActionTitle,
  actionLoading,
  actionResult,
  handleAction,
}) => {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Form layout="vertical" size="small">
        <Form.Item label="操作描述（自然语言）">
          <Input.TextArea
            value={actionPrompt}
            onChange={(e) => setActionPrompt(e.target.value)}
            placeholder="例如：帮我触发一次支付服务的发布流水线；创建审批流程；建议我执行什么命令来排查 CPU 高的问题"
            rows={3}
            disabled={actionLoading}
          />
        </Form.Item>
        <Form.Item label="标题（可选）">
          <Input
            value={actionTitle}
            onChange={(e) => setActionTitle(e.target.value)}
            placeholder="操作标题"
            disabled={actionLoading}
          />
        </Form.Item>
      </Form>
      <Space>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={actionLoading}
          onClick={() => handleAction('trigger_pipeline')}
          style={{
            backgroundColor: colors.purple[500],
            borderColor: colors.purple[500],
          }}
        >
          触发研发流程 Agent (TR-09)
        </Button>
        <Button
          type="primary"
          icon={<CloudServerOutlined />}
          loading={actionLoading}
          onClick={() => handleAction('suggest_command')}
          style={{
            backgroundColor: colors.info[500],
            borderColor: colors.info[500],
          }}
        >
          Ops 问答助手 (TR-11)
        </Button>
        <Button
          type="primary"
          icon={<FunnelPlotOutlined />}
          loading={actionLoading}
          onClick={() => handleAction('generate_flow')}
          style={{
            backgroundColor: colors.purple[500],
            borderColor: colors.purple[500],
          }}
        >
          AI 生成流程 (TR-10)
        </Button>
      </Space>
      {actionResult && (
        <Card
          size="small"
          style={{
            marginTop: 4,
            padding: 10,
            background: themeVars.bgSecondary,
          }}
        >
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <div>
              <Tag color={actionResult.status === 'executed' ? 'green' : 'blue'}>
                {actionResult.status}
              </Tag>
              <Tag>{actionResult.kind}</Tag>
              {actionResult.entity_id && <Tag>{actionResult.entity_id}</Tag>}
            </div>
            <Text style={{ fontSize: 13 }}>{actionResult.summary}</Text>
            {actionResult.steps && actionResult.steps.length > 0 && (
              <Space direction="vertical" size={2}>
                {actionResult.steps.map((step, i) => (
                  <Text
                    key={String(i)}
                    style={{ fontSize: 12, color: colors.neutral[500] }}
                  >
                    {i + 1}. {step}
                  </Text>
                ))}
              </Space>
            )}
            {actionResult.error && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {actionResult.error}
              </Text>
            )}
          </Space>
        </Card>
      )}
    </Space>
  );
};
