/**
 * ChatTrigger Component
 * - 右下角 ChatOps 聊天入口
 * - 干净的按钮设计，无红点/状态指示灯
 * - 点击展开纯聊天面板
 */
import React from 'react';
import { Tooltip } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';

const ChatTrigger: React.FC = () => {
  const { isOpen, toggle } = useChatOpsStore();

  if (isOpen) return null;

  return (
    <Tooltip title="打开 ChatOps">
      <div
        onClick={toggle}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.purple[500]} 100%)`,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          cursor: 'pointer',
          zIndex: 999,
          boxShadow: `0 4px 16px ${colors.primary[500]}40`,
          transition: 'all 0.3s ease',
          border: '2px solid rgba(255,255,255,0.3)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = `0 6px 20px ${colors.primary[500]}50`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = `0 4px 16px ${colors.primary[500]}40`;
        }}
      >
        <MessageOutlined />
      </div>
    </Tooltip>
  );
};

export { ChatTrigger };
