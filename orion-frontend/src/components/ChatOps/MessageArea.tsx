import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/stores/chatOpsStore';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';
import { useAutoScroll } from './hooks/useAutoScroll';

export const MessageArea: React.FC = () => {
  const { messages } = useChatOpsStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const { showScrollButton, scrollToBottomIfAuto, scrollToBottom } = useAutoScroll(containerRef);

  useEffect(() => {
    scrollToBottomIfAuto();
  }, [messages.length, scrollToBottomIfAuto]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        background: colors.light.bg.secondary,
        minHeight: 200,
        padding: '8px 0 12px',
      }}
    >
      {messages.map((msg, index) => {
        const prevMsg = messages[index - 1];
        const showAvatar = !prevMsg || prevMsg.role !== msg.role;
        return (
          <ChatMessage
            key={msg.id}
            message={msg as ChatMessageType}
            showAvatar={showAvatar}
            compact={!showAvatar}
          />
        );
      })}

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div
          onClick={() => scrollToBottom()}
          style={{
            position: 'sticky',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.light.bg.primary,
            color: colors.primary[500],
            padding: '6px 14px',
            borderRadius: 16,
            fontSize: 12,
            cursor: 'pointer',
            zIndex: 998,
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            border: `1px solid ${colors.primary[100]}`,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 14 }}>↓</span>
          新消息
        </div>
      )}
    </div>
  );
};
