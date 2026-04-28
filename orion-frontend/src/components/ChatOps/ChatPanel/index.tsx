import React from 'react';
import { Drawer } from 'antd';
import { useChatOpsStore, initializeChatOpsStore } from '@/stores/chatOpsStore';
import { SmartRecommend } from '../SmartRecommend';
import { MessageArea } from '../MessageArea';
import { ChatInput } from '../ChatInput';

// 响应式宽度计算
function usePanelWidth(): number {
  const [width, setWidth] = React.useState(400);
  React.useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w <= 1366) setWidth(360);
      else if (w >= 1920) setWidth(480);
      else setWidth(400);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return width;
}

export const ChatPanel: React.FC = () => {
  const { isOpen, toggle } = useChatOpsStore();
  const panelWidth = usePanelWidth();

  // TE-9: ChatPanel 挂载时触发 Store 初始化
  React.useEffect(() => {
    initializeChatOpsStore();
  }, []);

  return (
    <Drawer
      open={isOpen}
      onClose={toggle}
      width={panelWidth}
      placement="right"
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
        header: { display: 'none' },
      }}
      style={{
        boxShadow: '-4px 0 16px rgba(0,0,0,0.06)',
      }}
    >
      <SmartRecommend />
      <MessageArea />
      <ChatInput />
    </Drawer>
  );
};
