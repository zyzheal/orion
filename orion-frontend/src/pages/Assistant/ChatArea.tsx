/**
 * ChatArea.tsx - Assistant 聊天消息展示区
 * 抽取自 Assistant/index.tsx (P2-9 Phase 66)
 */
import React from 'react';
import { Button, Space, Tag, Typography, Spin, Empty, Divider } from 'antd';
import {
  DatabaseOutlined,
} from '@ant-design/icons';
import { colors, themeVars } from '@/tokens';
import { SUGGESTIONS, INTENT_LABEL } from './constants';
import type { ChatItem } from './types';

const { Text } = Typography;

interface ChatAreaProps {
  messages: ChatItem[];
  loading: boolean;
  ask: (q?: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, loading, ask }) => {
  if (messages.length === 0) {
    return (
      <Empty
        style={{ marginTop: 80 }}
        description={
          <Space direction="vertical" size={8} style={{ alignItems: 'center' }}>
            <Text>从下面的示例问题开始，或直接描述你的诉求</Text>
            <Space wrap>
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="small" onClick={() => ask(s)}>
                  {s}
                </Button>
              ))}
            </Space>
          </Space>
        }
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            gap: 8,
          }}
        >
          <div
            style={{
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: 10,
              background: m.role === 'user' ? colors.primary[500] : themeVars.bgSecondary,
              color: m.role === 'user' ? colors.neutral[900] : 'inherit',
            }}
          >
            {m.role === 'assistant' && m.response && (
              <div style={{ marginBottom: 6 }}>
                {m.response.intent && INTENT_LABEL[m.response.intent] && (
                  <Tag
                    color={INTENT_LABEL[m.response.intent].color}
                    style={{ marginRight: 6 }}
                  >
                    {INTENT_LABEL[m.response.intent].label}
                  </Tag>
                )}
                {m.response.generated && <Tag color="purple">AI 生成</Tag>}
              </div>
            )}
            <Text
              style={{
                color: m.role === 'user' ? colors.neutral[900] : undefined,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </Text>

            {m.role === 'assistant' &&
              m.response?.sources &&
              m.response.sources.length > 0 && (
                <>
                  <Divider style={{ margin: '10px 0' }} />
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.neutral[500],
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <DatabaseOutlined /> 引用来源（{m.response.sources.length}）
                  </Text>
                  <div style={{ marginTop: 6 }}>
                    {m.response.sources.slice(0, 5).map((s, idx) => (
                      <Tag key={String(idx)} style={{ marginBottom: 4 }}>
                        {s.title}
                      </Tag>
                    ))}
                  </div>
                </>
              )}
          </div>
        </div>
      ))}
      {loading && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <Spin size="small" />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            正在检索多个数据源…
          </Text>
        </div>
      )}
    </Space>
  );
};
