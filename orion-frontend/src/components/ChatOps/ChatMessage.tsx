import React from 'react';
import { colors } from '@/tokens/colors';
import { ActionCard } from './ActionCard';

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: Array<{ label: string; command: string; params: Record<string, unknown> }>;
  status?: 'success' | 'failed' | 'running';
}

export const ChatMessage: React.FC<{ message: ChatMessageData }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: colors.light.text.tertiary }}>
        {message.content}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      padding: '4px 16px',
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '8px 12px',
        borderRadius: isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
        background: isUser
          ? `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`
          : colors.light.bg.primary,
        color: isUser ? '#fff' : colors.light.text.primary,
        border: isUser ? 'none' : `1px solid ${colors.light.border.light}`,
      }}>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </div>
        {message.actions && message.actions.length > 0 && (
          <ActionCard actions={message.actions} status={message.status} />
        )}
        <div style={{
          fontSize: 10,
          marginTop: 4,
          textAlign: isUser ? 'right' : 'left',
          opacity: 0.6,
        }}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};
