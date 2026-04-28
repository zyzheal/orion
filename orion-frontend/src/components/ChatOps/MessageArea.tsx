import React, { useRef, useEffect, useState } from 'react';
import { VirtualList } from '@/components/VirtualList';
import { ChatMessage } from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '@/stores/chatOpsStore';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';
import { useAutoScroll } from './hooks/useAutoScroll';

export const MessageArea: React.FC = () => {
  const { messages } = useChatOpsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(400);

  // TE-14: ResizeObserver 动态测量容器高度
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.floor(entry.contentRect.height);
        if (h > 0) setContainerHeight(h);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { showScrollButton, scrollToBottomIfAuto, scrollToBottom } = useAutoScroll(containerRef);

  // 消息变化时自动滚动
  useEffect(() => {
    scrollToBottomIfAuto();
  }, [messages.length, scrollToBottomIfAuto]);

  const virtualItems = messages.map((msg) => ({
    id: msg.id,
    data: msg as ChatMessageType,
  }));

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 200,
        background: colors.light.bg.secondary,
        position: 'relative',
      }}
    >
      <VirtualList
        items={virtualItems}
        containerHeight={containerHeight}
        itemHeight={80}
        overscanCount={5}
        renderItem={(item: { data: ChatMessageType }) => <ChatMessage message={item.data} />}
        emptyText="暂无对话，输入命令开始"
      />

      {/* 滚动暂停时显示 "新消息" 按钮 */}
      {showScrollButton && (
        <div
          onClick={() => scrollToBottom()}
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.primary[500],
            color: '#fff',
            padding: '6px 16px',
            borderRadius: 16,
            fontSize: 12,
            cursor: 'pointer',
            zIndex: 998,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          ↓ 新消息
        </div>
      )}
    </div>
  );
};
