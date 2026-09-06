/**
 * Global AI Assistant (Copilot) Page (TR-02)
 * - 跨模块问答: 意图识别 → 多源检索 → 综合回答
 * - 多轮对话 + 数据源接通 + 智能操作
 * - 7 文件拆分: types.ts + constants.ts + useAssistantState.ts + ChatArea.tsx + SessionSidebar.tsx + ActionPanel.tsx + DataSourcePanel.tsx
 * 抽取自 707 行原始文件 (P2-9 Phase 66)
 */
import React from 'react';
import {
  Button,
  Input,
  Space,
  Typography,
  Collapse,
  Layout,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  BulbOutlined,
  ClearOutlined,
  ImportOutlined,
  ThunderboltOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { colors, themeVars, spacing } from '@/tokens';
import { useAssistantState } from './useAssistantState';
import { ChatArea } from './ChatArea';
import { SessionSidebar } from './SessionSidebar';
import { ActionPanel } from './ActionPanel';
import { DataSourcePanel } from './DataSourcePanel';

const { Title, Text, Paragraph } = Typography;

const AssistantPage: React.FC = () => {
  const {
    question, setQuestion,
    messages, loading,
    sessions, currentSessionId,
    sidebarOpen, setSidebarOpen,
    actionLoading, actionResult, actionPrompt, setActionPrompt,
    actionTitle, setActionTitle,
    importSource, setImportSource, ingesting,
    selectSession, newSession, deleteSession,
    ask, clearChat, handleAction, handleIngest,
  } = useAssistantState();

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 8px' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.md }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          智能助手
        </Title>
        <Text type="secondary">
          跨模块问答：可同时检索知识库、流水线、告警、工单与变更记录，给出综合回答。
        </Text>
      </div>

      <Layout style={{ display: 'flex', gap: spacing.md }}>
        {/* Session sidebar */}
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          open={sidebarOpen}
          onSelect={selectSession}
          onNew={newSession}
          onDelete={deleteSession}
          onToggle={() => setSidebarOpen(false)}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Toggle sidebar button */}
          {!sidebarOpen && (
            <Button
              size="small"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setSidebarOpen(true)}
              style={{ marginBottom: spacing.sm }}
            >
              会话历史
            </Button>
          )}

          {/* Chat area */}
          <div
            style={{
              minHeight: 420,
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: 12,
              padding: spacing.lg,
              background: themeVars.bgPrimary,
            }}
          >
            <ChatArea messages={messages} loading={loading} ask={ask} />
          </div>

          {/* Input bar */}
          <div style={{ display: 'flex', gap: 8, marginTop: spacing.md }}>
            <Input.TextArea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="输入问题，例如：为什么订单一小时前失败？"
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <Space direction="vertical" size={4}>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={loading}
                onClick={() => ask()}
                style={{ height: 40 }}
              >
                提问
              </Button>
              <Button
                size="small"
                icon={<ClearOutlined />}
                onClick={clearChat}
                disabled={messages.length === 0}
              >
                清空
              </Button>
            </Space>
          </div>

          <Paragraph type="secondary" style={{ marginTop: spacing.sm, fontSize: 12 }}>
            <BulbOutlined /> 助手回答依赖已接入的数据源；运行结果由后端 assistant
            模块意图路由与检索合成。
          </Paragraph>

          {/* Data source ingestion + Action panels */}
          <div style={{ marginTop: spacing.md }}>
            <Collapse
              ghost
              items={[
                {
                  key: 'ingest',
                  label: (
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      <ImportOutlined /> 数据源接通演示 —
                      把告警/工单/变更/事件推入知识库，供助手检索
                    </Text>
                  ),
                  children: (
                    <DataSourcePanel
                      importSource={importSource}
                      setImportSource={setImportSource}
                      ingesting={ingesting}
                      handleIngest={handleIngest}
                    />
                  ),
                },
                {
                  key: 'actions',
                  label: (
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>
                      <ThunderboltOutlined /> 智能操作 — 触发研发流程 Agent / AI 生成流程 / Ops
                      问答助手
                    </Text>
                  ),
                  children: (
                    <ActionPanel
                      actionPrompt={actionPrompt}
                      setActionPrompt={setActionPrompt}
                      actionTitle={actionTitle}
                      setActionTitle={setActionTitle}
                      actionLoading={actionLoading}
                      actionResult={actionResult}
                      handleAction={handleAction}
                    />
                  ),
                },
              ]}
            />
          </div>
        </div>
      </Layout>
    </div>
  );
};

export default AssistantPage;
