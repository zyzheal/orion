/**
 * RAG Query - RAG Q&A interface with retrieval results
 */
import React, { useState, useEffect } from 'react';
import { Typography, Button, Space, Tag, Card, Input, Select, Collapse, Progress, Row, Col } from 'antd';
import { colors, spacing } from '@/tokens';
import { SendOutlined, BookOutlined } from '@ant-design/icons';
import { ragQuery, getSpaces, type RAGResult } from '@/api/ai-docs';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGResult[];
  confidence?: number;
  timestamp: string;
}

const RAGQueryPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>('');
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);

  const loadSpaces = async () => {
    try {
      const res = await getSpaces();
      const spaceList = Array.isArray(res.data.data) ? res.data.data : [];
      setSpaces(spaceList.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
    } catch {
      setSpaces([{ id: 'all', name: '全部知识库' }, { id: 's1', name: '技术文档库' }, { id: 's2', name: '团队知识库' }]);
    }
  };

  useEffect(() => {
    loadSpaces();
  }, []);

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
      const data = res.data.data as { answer?: string; sources?: RAGResult[]; confidence?: number };
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data?.answer || `根据知识库检索，关于"${currentQuery}"的回答如下...`,
        sources: Array.isArray(data?.sources) ? data.sources : [],
        confidence: data?.confidence || 85,
        timestamp: dayjs().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      // Mock response
      const mockSources: RAGResult[] = [
        { documentId: 'd1', title: 'API 设计最佳实践', snippet: 'RESTful API 应该遵循资源命名规范...', relevanceScore: 0.92, spaceId: 's1' },
        { documentId: 'd2', title: 'Kubernetes 运维手册', snippet: '部署时需要注意资源配置...', relevanceScore: 0.78, spaceId: 's1' },
      ];
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `根据知识库检索，关于"${currentQuery}"，我找到以下相关信息：\n\n1. API 设计应该遵循 RESTful 原则，使用名词作为资源路径。\n2. 部署配置需要注意资源限制和健康检查。`,
        sources: mockSources,
        confidence: 85,
        timestamp: dayjs().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 0 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>RAG 查询</Title>
        <Text type="secondary">基于知识库的问答检索</Text>
      </div>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="对话" style={{ minHeight: 500 }}>
            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16 }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: msg.role === 'user' ? colors.info[50] : colors.neutral[50] }}>
                  <Space style={{ marginBottom: 4 }}>
                    <Tag color={msg.role === 'user' ? 'blue' : 'green'}>{msg.role === 'user' ? '用户' : 'AI'}</Tag>
                    <Text type="secondary" style={{ fontSize: spacing[3] }}>{dayjs(msg.timestamp).format('HH:mm:ss')}</Text>
                    {msg.confidence !== undefined && (
                      <Tag>置信度 {msg.confidence}%</Tag>
                    )}
                  </Space>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                </div>
              ))}
              {loading && <Text type="secondary">正在检索知识库...</Text>}
            </div>

            <Space style={{ width: '100%' }}>
              <Select value={selectedSpace} onChange={setSelectedSpace} style={{ width: 150 }}
                options={spaces.map((s) => ({ label: s.name, value: s.id }))} placeholder="选择知识库" allowClear />
              <TextArea value={query} onChange={(e) => setQuery(e.target.value)} onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleQuery(); } }}
                placeholder="输入问题..." style={{ flex: 1 }} autoSize={{ minRows: 1, maxRows: 4 }} />
              <Button type="primary" icon={<SendOutlined />} onClick={handleQuery} loading={loading}>发送</Button>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><BookOutlined />检索结果</Space>}>
            {messages.filter((m) => m.role === 'assistant' && m.sources && m.sources.length > 0).reverse()[0]?.sources?.map((source, index) => (
              <Collapse key={index} items={[{
                key: source.documentId,
                label: <Space><Text strong style={{ fontSize: spacing[3] }}>{source.title}</Text><Tag color="blue">{(source.relevanceScore * 100).toFixed(0)}%</Tag></Space>,
                children: <div>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>{source.snippet}</Text>
                  <br />
                  <Progress percent={source.relevanceScore * 100} size="small" strokeColor="colors.primary[500]" style={{ marginTop: 8 }} />
                </div>,
              }]} defaultActiveKey={[]} size="small" />
            ))}
            {messages.filter((m) => m.role === 'assistant' && m.sources && m.sources.length > 0).length === 0 && (
              <Text type="secondary">检索结果将在此显示</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RAGQueryPage;
