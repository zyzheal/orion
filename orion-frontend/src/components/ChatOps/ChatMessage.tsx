import React from 'react';
import { Avatar } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { ActionCard } from './ActionCard';
import type { ExtendedAction } from '@/components/ChatOps/types';

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ExtendedAction[];
  status?: 'success' | 'failed' | 'running';
}

interface ChatMessageProps {
  message: ChatMessageData;
  showAvatar?: boolean;
  compact?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  showAvatar = true,
  compact = false,
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 16px' }}>
        <span
          style={{
            fontSize: 11,
            color: colors.light.text.tertiary,
            background: colors.light.bg.secondary,
            padding: '3px 10px',
            borderRadius: 10,
          }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        padding: compact ? '1px 16px' : '6px 16px',
        marginTop: compact ? 0 : 6,
      }}
    >
      {/* Avatar */}
      <div style={{ width: 32, height: 32, flexShrink: 0 }}>
        {showAvatar ? (
          <Avatar
            size={32}
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              background: isUser
                ? `linear-gradient(135deg, ${colors.purple[400]}, ${colors.purple[600]})`
                : `linear-gradient(135deg, ${colors.primary[400]}, ${colors.info[500]})`,
              fontSize: 15,
              boxShadow: isUser
                ? `0 2px 6px ${colors.purple[400]}30`
                : `0 2px 6px ${colors.primary[400]}30`,
            }}
          />
        ) : null}
      </div>

      {/* Message Content */}
      <div style={{ maxWidth: '70%' }}>
        {/* Bubble */}
        <div
          style={{
            padding: '8px 14px',
            borderRadius: isUser
              ? '18px 4px 18px 18px'
              : '4px 18px 18px 18px',
            background: isUser
              ? `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`
              : colors.light.bg.primary,
            color: isUser ? '#ffffff' : colors.light.text.primary,
            border: isUser ? 'none' : `1px solid ${colors.light.border.light}`,
            boxShadow: isUser
              ? `0 2px 10px ${colors.primary[400]}30`
              : '0 1px 4px rgba(0,0,0,0.04)',
            position: 'relative',
          }}
        >
          {/* Message Text */}
          <div
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
              fontSize: 13.5,
              letterSpacing: 0.1,
            }}
          >
            {message.content}
          </div>

          {/* Action Cards */}
          {message.actions && message.actions.length > 0 && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: isUser ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${colors.light.border.light}`,
              }}
            >
              <ActionCard actions={message.actions} status={message.status} />
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div
          style={{
            fontSize: 10,
            marginTop: 3,
            padding: '0 4px',
            color: colors.light.text.tertiary,
            opacity: 0.6,
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {message.timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
};
