import React from 'react';
import { Drawer, Typography } from 'antd';
import {
  MessageOutlined,
  CloseOutlined,
  RocketOutlined,
  BarChartOutlined,
  BugOutlined,
  CloudServerOutlined,
  SecurityScanOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { AntdIconProps } from '@ant-design/icons/lib/components/AntdIcon';
import { useChatOpsStore, initializeChatOpsStore } from '@/stores/chatOpsStore';
import { useChatOpsConfigStore } from '@/stores/chatOpsConfigStore';
import { SmartRecommend } from '../SmartRecommend';
import { MessageArea } from '../MessageArea';
import { ChatInput } from '../ChatInput';
import { colors } from '@/tokens/colors';

const { Text } = Typography;

// Icon 名称到组件的映射
const ICON_MAP: Record<string, React.FC<AntdIconProps>> = {
  RocketOutlined,
  BarChartOutlined,
  BugOutlined,
  CloudServerOutlined,
  SecurityScanOutlined,
  SettingOutlined,
};

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

interface QuestionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ icon, title, desc, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: colors.light.bg.primary,
      border: `1px solid ${colors.light.border.light}`,
      borderRadius: 12,
      padding: '12px 14px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = colors.primary[300];
      (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${colors.primary[100]}`;
      (e.currentTarget as HTMLElement).style.background = colors.primary[50];
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = colors.light.border.light;
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      (e.currentTarget as HTMLElement).style.background = colors.light.bg.primary;
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `linear-gradient(135deg, ${colors.primary[50]}, ${colors.primary[100]})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: colors.primary[500],
        fontSize: 15,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 2 }}>{title}</Text>
      <Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>{desc}</Text>
    </div>
  </div>
);

export const ChatPanel: React.FC = () => {
  const { isOpen, toggle, messages, sendMessage } = useChatOpsStore();
  const { questions, loadConfig } = useChatOpsConfigStore();
  const panelWidth = usePanelWidth();

  React.useEffect(() => {
    initializeChatOpsStore();
    loadConfig().catch((error: unknown) => console.error('Failed to load chat config:', error));
  }, []);

  // Prevent background scrolling when panel is open
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleQuestionClick = async (question: string) => {
    await sendMessage(question);
  };

  const isEmpty = messages.length === 0;
  const enabledQuestions = questions.filter((q) => q.enabled);

  return (
    <Drawer
      open={isOpen}
      onClose={toggle}
      width={panelWidth}
      placement="right"
      destroyOnClose={false}
      mask={false}
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: colors.light.bg.primary,
        },
        header: { display: 'none' },
        mask: { background: 'transparent' },
      }}
      style={{
        boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: `1px solid ${colors.light.border.light}`,
          background: colors.light.bg.primary,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${colors.primary[400]}, ${colors.primary[600]})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MessageOutlined style={{ fontSize: 15, color: colors.neutral[0] }} />
          </div>
          <Text strong style={{ fontSize: 15 }}>ChatOps 助手</Text>
        </div>
        <div
          onClick={toggle}
          style={{
            cursor: 'pointer',
            width: 28,
            height: 28,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
            color: colors.light.text.tertiary,
            fontSize: 12,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = colors.light.bg.secondary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <CloseOutlined />
        </div>
      </div>

      {/* Content Area */}
      {isEmpty ? (
        /* Welcome + SmartRecommend + Configurable Questions */
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: colors.light.bg.secondary,
            padding: '20px 16px',
          }}
        >
          {/* Welcome Section */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${colors.primary[400]}, ${colors.primary[600]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                boxShadow: `0 4px 12px ${colors.primary[400]}30`,
              }}
            >
              <MessageOutlined style={{ fontSize: 22, color: colors.neutral[0] }} />
            </div>
            <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
              你好，我是 ChatOps 助手
            </Text>
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              我可以帮你查看流水线状态、分析告警、管理部署...
            </Text>
          </div>

          {/* SmartRecommend — 轻量提示条，融入欢迎区域 */}
          <SmartRecommend />
          {/* Quick Questions Grid */}
          {enabledQuestions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 10, display: 'block' }}>
                你可以问我：
              </Text>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {enabledQuestions.map((q) => {
                  const IconComp = ICON_MAP[q.icon] || SettingOutlined;
                  return (
                    <QuestionCard
                      key={q.key}
                      icon={<IconComp />}
                      title={q.title}
                      desc={q.desc}
                      onClick={() => handleQuestionClick(q.question)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Message Area */
        <MessageArea />
      )}

      {/* Chat Input */}
      <ChatInput />
    </Drawer>
  );
};
