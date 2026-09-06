/**
 * SessionSidebar.tsx - Assistant 会话侧边栏
 * 抽取自 Assistant/index.tsx (P2-9 Phase 66)
 */
import React from 'react';
import { Space, Button, Typography, List } from 'antd';
import {
  PlusOutlined,
  MenuFoldOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { colors, themeVars, spacing } from '@/tokens';
import type { AssistantSession } from '@/api/assistant';

const { Text } = Typography;

interface SessionSidebarProps {
  sessions: AssistantSession[];
  currentSessionId: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onToggle: () => void;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  currentSessionId,
  open,
  onSelect,
  onNew,
  onDelete,
  onToggle,
}) => {
  if (!open) return null;

  return (
    <div
      style={{
        width: 240,
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: 12,
        padding: spacing.sm,
        background: themeVars.bgSecondary,
        maxHeight: 600,
        overflow: 'auto',
        flexShrink: 0,
      }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}
      >
        <Text strong>会话历史</Text>
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={onNew}>
            新建
          </Button>
          <Button size="small" icon={<MenuFoldOutlined />} onClick={onToggle} />
        </Space>
      </div>
      <List
        dataSource={sessions}
        renderItem={(session) => (
          <List.Item
            style={{
              padding: spacing.xs,
              cursor: 'pointer',
              background:
                currentSessionId === session.id ? colors.primary[50] : 'transparent',
              borderRadius: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onClick={() => onSelect(session.id)}
          >
            <Space style={{ flex: 1, overflow: 'hidden' }}>
              <FolderOpenOutlined />
              <Text
                ellipsis={{ tooltip: `${session.messages?.length || 0} 条消息` }}
                style={{ fontSize: 12 }}
              >
                {(session.messages?.[0]?.content || '新会话').slice(0, 20)}
              </Text>
            </Space>
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session.id);
              }}
            />
          </List.Item>
        )}
      />
    </div>
  );
};
