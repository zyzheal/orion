/**
 * ChatOps 对话工作台 (Phase 3)
 * 用自然语言与 AI 助手交流，执行运维操作
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Input, Button, Avatar, Spin, Typography, Space, Tag, message, Empty } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ToolOutlined, ClearOutlined } from '@ant-design/icons';
import { sendChatMessage, getAvailableTools, type ChatResponse, type ToolInfo } from '@/api/chatops';
import { colors, spacing } from '@/tokens';

const { TextArea } = Input;
const { Text } = Typography;

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: number;
  toolCalls?: Array<{ tool: string; params: Record<string, unknown>; status: string; result?: unknown }>;
  suggestions?: string[];
}

const WELCOME_MESSAGE: ChatMsg = {
  id: 'welcome',
  role: 'assistant',
  content: '你好！我是 Orion AI 运维助手。可以用自然语言让我帮你执行运维操作，例如：\n\n• "查询 CPU 使用率"\n• "部署应用到生产环境"\n• "诊断服务问题"\n• "查看部署状态"',
  timestamp: new Date(),
};

const QUICK_ACTIONS = [
  '查询 CPU 使用率',
  '查看最近错误日志',
  '服务状态怎么样',
  '诊断 API 服务问题',
];

export default function ChatOpsChat() {
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    getAvailableTools()
      .then((res) => setTools(res.data.tools || []))
      .catch(() => {});
  }, []);

  const handleSend = async (text?: string) => {
    const userMessage = (text || input).trim();
    if (!userMessage || isLoading) return;

    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: userMessage, timestamp: new Date() },
    ]);
    setIsLoading(true);

    try {
      const res = await sendChatMessage({ message: userMessage });
      const data = res.data as ChatResponse;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          intent: data.intent,
          confidence: data.confidence,
          toolCalls: data.toolCalls,
          suggestions: data.suggestions,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '抱歉，处理你的请求时出错。请稍后重试。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  const renderMessage = (msg: ChatMsg) => {
    const isUser = msg.role === 'user';

    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: spacing[4],
        }}
      >
        <Space align="start" style={{ maxWidth: '75%' }}>
          {!isUser && (
            <Avatar icon={<RobotOutlined />} style={{ backgroundColor: colors.primary[500] }} />
          )}
          <Card
            size="small"
            style={{
              backgroundColor: isUser ? colors.primary[500] : colors.light.bg.secondary,
              color: isUser ? '#fff' : undefined,
              borderRadius: 12,
            }}
            bodyStyle={{ padding: '8px 12px' }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space size={4}>
                <Text strong style={{ fontSize: 12, color: isUser ? 'rgba(255,255,255,0.8)' : colors.light.text.secondary }}>
                  {isUser ? '你' : 'AI 助手'}
                </Text>
                {msg.intent && (
                  <Tag color="blue" style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
                    {msg.intent}
                  </Tag>
                )}
                {msg.confidence != null && (
                  <Text style={{ fontSize: 10, color: isUser ? 'rgba(255,255,255,0.6)' : colors.light.text.tertiary }}>
                    {Math.round(msg.confidence * 100)}%
                  </Text>
                )}
              </Space>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <Space direction="vertical" size={2}>
                  <Text style={{ fontSize: 11, color: isUser ? 'rgba(255,255,255,0.7)' : colors.light.text.secondary }}>
                    <ToolOutlined /> 工具调用:
                  </Text>
                  <Space wrap>
                    {msg.toolCalls.map((tc, i) => (
                      <Tag key={i} color={tc.status === 'completed' ? 'green' : 'orange'}>
                        {tc.tool}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              )}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <Space wrap>
                  {msg.suggestions.map((s, i) => (
                    <Button
                      key={i}
                      size="small"
                      type={isUser ? 'default' : 'link'}
                      style={isUser ? { color: '#fff', borderColor: 'rgba(255,255,255,0.5)' } : undefined}
                      onClick={() => handleSend(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </Space>
              )}
            </Space>
          </Card>
          {isUser && (
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: colors.success[500] }} />
          )}
        </Space>
      </div>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 180px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `0 ${spacing[4]}px ${spacing[3]}px` }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 600, lineHeight: '24px', color: colors.light.text.primary }}>
            <RobotOutlined style={{ marginRight: spacing[2] }} />
            ChatOps 对话工作台
          </span>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            用自然语言与 AI 助手交流，执行运维操作
            {tools.length > 0 && ` · ${tools.length} 个可用工具`}
          </Text>
        </div>
        <Button icon={<ClearOutlined />} size="small" onClick={handleClear}>
          清空对话
        </Button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: spacing[3] }}>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: spacing[4],
            background: colors.light.bg.secondary,
            borderRadius: 8,
          }}
        >
          {messages.length === 0 ? (
            <Empty description="开始对话吧" />
          ) : (
            messages.map(renderMessage)
          )}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: spacing[4] }}>
              <Space>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: colors.primary[500] }} />
                <Spin size="small" />
              </Space>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <Space wrap style={{ marginTop: spacing[3], marginBottom: spacing[2] }}>
            {QUICK_ACTIONS.map((action) => (
              <Button key={action} size="small" onClick={() => handleSend(action)}>
                {action}
              </Button>
            ))}
          </Space>
        )}

        {/* Input */}
        <div style={{ marginTop: spacing[2] }}>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入自然语言指令，如：查询 CPU 使用率、部署应用到生产环境..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={isLoading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSend()}
              loading={isLoading}
              disabled={!input.trim()}
              style={{ width: 80 }}
            >
              发送
            </Button>
          </Space.Compact>
        </div>
      </div>
    </div>
  );
}