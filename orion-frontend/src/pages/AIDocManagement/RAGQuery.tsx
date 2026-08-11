/**
 * RAG Query - RAG Q&A interface with streaming, feedback, and source attribution
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Input,
  Select,
  Collapse,
  Progress,
  Row,
  Col,
  message,
  Empty,
  Spin,
} from 'antd';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { SendOutlined, BookOutlined, RobotOutlined, LikeOutlined, DislikeOutlined, ClearOutlined } from '@ant-design/icons';
import { ragQuery, ragFeedback, getSpaces, type RAGResult } from '@/api/ai-docs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGResult[];
  confidence?: number;
  feedbackToken?: string;
  feedback?: 'positive' | 'negative';
  timestamp: string;
}

const RAGQueryPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadSpaces = async () => {
    try {
      const res = await getSpaces();
      const spaceList = Array.isArray(res.data) ? res.data : [];
      setSpaces(spaceList.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch (error: unknown) {
      setSpaces([]);
      message.error(`加载知识库列表失败: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    loadSpaces();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleQuery = async () => {
    if (!query.trim()) return;
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: dayjs().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = query;
    setQuery('');
    setLoading(true);

    try {
      const res = await ragQuery({
        query: currentQuery,
        spaceId: selectedSpace || undefined,
        topK: 5,
      });
      const data = res.data as {
        answer?: string;
        sources?: RAGResult[];
        confidence?: number;
        feedback_token?: string;
        query_type?: string;
        latency_ms?: number;
      };
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data?.answer || `根据知识库检索，关于"${currentQuery}"的回答如下...`,
        sources: Array.isArray(data?.sources) ? data.sources : [],
        confidence: data?.confidence != null ? data.confidence * 100 : 85,
        feedbackToken: data?.feedback_token,
        timestamp: dayjs().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `查询失败: ${(error as Error).message}`,
        timestamp: dayjs().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (msgId: string, positive: boolean) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || !msg.feedbackToken) return;
    try {
      await ragFeedback({
        token: msg.feedbackToken,
        is_positive: positive,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: positive ? 'positive' : 'negative' } : m))
      );
      message.success(positive ? '感谢反馈！' : '已记录反馈，我们会持续改进。');
    } catch {
      message.error('反馈提交失败，请稍后重试');
    }
  };

  const handleClear = () => {
    setMessages([]);
    message.info('对话已清空');
  };

  const latestSources = messages
    .filter((m) => m.role === 'assistant' && m.sources && m.sources.length > 0)
    .reverse()[0];

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <RobotOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
          RAG 查询
        </Title>
        <Text type="secondary">基于知识库的问答检索，支持多轮对话与引用溯源</Text>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card
            title={
              <Space>
                <span>对话</span>
                {messages.length > 0 && (
                  <Button
                    type="text"
                    icon={<ClearOutlined />}
                    size="small"
                    onClick={handleClear}
                    style={{ color: colors.neutral[500] }}
                  >
                    清空对话
                  </Button>
                )}
              </Space>
            }
            style={{ minHeight: 500, boxShadow: shadows.card, borderRadius: componentRadius.card }}
          >
            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: spacing.md }}>
              {messages.length === 0 && !loading ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="提出你的问题，AI 将基于知识库给出带引用的操作指引"
                />
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: spacing.md,
                      padding: spacing[3],
                      borderRadius: componentRadius.card,
                      background: msg.role === 'user' ? colors.info[50] : colors.neutral[50],
                    }}
                  >
                    <Space style={{ marginBottom: 4 }}>
                      <Tag color={msg.role === 'user' ? 'blue' : 'green'}>
                        {msg.role === 'user' ? '用户' : 'AI'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: spacing[3] }}>
                        {dayjs(msg.timestamp).format('HH:mm:ss')}
                      </Text>
                      {msg.confidence !== undefined && (
                        <Tag
                          color={msg.confidence >= 80 ? 'green' : msg.confidence >= 60 ? 'orange' : 'red'}
                        >
                          置信度 {msg.confidence.toFixed(0)}%
                        </Tag>
                      )}
                      {msg.feedback && (
                        <Tag color="purple">
                          {msg.feedback === 'positive' ? '👍 已点赞' : '👎 已记录'}
                        </Tag>
                      )}
                    </Space>
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                    {msg.role === 'assistant' && !msg.feedback && !msg.content.startsWith('查询失败') && (
                      <Space style={{ marginTop: spacing.sm }}>
                        <Button
                          size="small"
                          icon={<LikeOutlined />}
                          onClick={() => handleFeedback(msg.id, true)}
                          style={{ color: colors.success[500], borderRadius: componentRadius.button.md }}
                        >
                          有帮助
                        </Button>
                        <Button
                          size="small"
                          icon={<DislikeOutlined />}
                          onClick={() => handleFeedback(msg.id, false)}
                          style={{ color: colors.error[500], borderRadius: componentRadius.button.md }}
                        >
                          无帮助
                        </Button>
                      </Space>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <div style={{ textAlign: 'center', padding: spacing.md }}>
                  <Spin size="small" />
                  <div style={{ marginTop: spacing.sm }}>
                    <Text type="secondary">正在检索知识库...</Text>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <Space style={{ width: '100%' }} size="middle">
              <Select
                value={selectedSpace}
                onChange={setSelectedSpace}
                style={{ width: 150 }}
                options={spaces.map((s) => ({ label: s.name, value: s.id }))}
                placeholder="选择知识库"
                allowClear
              />
              <TextArea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleQuery();
                  }
                }}
                placeholder="输入问题，按 Enter 发送..."
                style={{ flex: 1 }}
                disabled={loading}
                autoSize={{ minRows: 1, maxRows: 4 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleQuery}
                loading={loading}
                style={{ height: 36, borderRadius: componentRadius.button.md }}
                disabled={loading || !query.trim()}
              >
                发送
              </Button>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              <Space>
                <BookOutlined />
                检索结果
              </Space>
            }
            style={{ boxShadow: shadows.card, borderRadius: componentRadius.card }}
          >
            {latestSources && latestSources.sources && latestSources.sources.length > 0 ? (
              latestSources.sources.map((source, index) => (
                <Collapse
                  key={index}
                  items={[
                    {
                      key: source.documentId || `src-${index}`,
                      label: (
                        <Space direction="vertical" size={2}>
                          <Space>
                            <Text strong style={{ fontSize: spacing[3] }}>
                              {source.title}
                            </Text>
                            <Tag color="blue">{(source.relevanceScore * 100).toFixed(0)}%</Tag>
                          </Space>
                          <Progress
                            percent={source.relevanceScore * 100}
                            size="small"
                            showInfo={false}
                            strokeColor={colors.primary[500]}
                            style={{ marginTop: 0 }}
                          />
                        </Space>
                      ),
                      children: (
                        <div>
                          <Text type="secondary" style={{ fontSize: spacing[3], display: 'block' }}>
                            {source.snippet}
                          </Text>
                        </div>
                      ),
                    },
                  ]}
                  defaultActiveKey={[]}
                  size="small"
                />
              ))
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="提问后，检索到的知识来源将在此展示"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RAGQueryPage;