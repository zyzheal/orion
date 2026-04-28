import React, { useEffect } from 'react';
import { Badge, Tooltip } from 'antd';
import { BellOutlined, MessageOutlined, LoadingOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { extractPageContext } from './pageContext';
import { colors } from '@/tokens/colors';
import { useLocation } from 'react-router-dom';

const ChatTrigger: React.FC = () => {
  const { isOpen, toggle, alertLevel, unreadAlerts, setPageContext } = useChatOpsStore();
  const location = useLocation();

  // FE-2/P2-2: 使用集中管理的 pageContext 提取路由上下文
  useEffect(() => {
    const ctx = extractPageContext(location.pathname);
    setPageContext(ctx);
  }, [location.pathname, setPageContext]);

  if (isOpen) return null;

  const effectiveLevel = unreadAlerts > 0
    ? (alertLevel === 'normal' ? 'warning' : alertLevel)
    : 'normal';

  const statusConfig = {
    normal: { icon: <MessageOutlined />, color: colors.primary[500], gradient: `linear-gradient(135deg, ${colors.primary[400]}, ${colors.primary[600]})` },
    warning: { icon: <BellOutlined />, color: colors.warning[500], gradient: `linear-gradient(135deg, ${colors.warning[400]}, ${colors.warning[600]})` },
    critical: { icon: <BellOutlined />, color: colors.error[400], gradient: `linear-gradient(135deg, ${colors.error[400]}, ${colors.error[500]})`, pulse: true },
    executing: { icon: <LoadingOutlined spin />, color: colors.warning[500], gradient: `linear-gradient(135deg, ${colors.warning[400]}, ${colors.warning[600]})` },
  };

  const config = statusConfig[effectiveLevel === 'executing' ? 'executing' : effectiveLevel === 'critical' ? 'critical' : effectiveLevel === 'warning' ? 'warning' : 'normal'];

  return (
    <Tooltip title={unreadAlerts > 0 ? `${unreadAlerts} 条待处理告警` : '打开 ChatOps'}>
      <Badge count={unreadAlerts > 0 ? unreadAlerts : undefined}>
        <div
          onClick={toggle}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: config.gradient,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            cursor: 'pointer',
            zIndex: 999, // TE-13: 在 Drawer (1000) 之下
            boxShadow: `0 4px 12px ${config.color}40`,
            transition: 'all 0.3s',
          }}
          className={'pulse' in config && config.pulse ? 'chat-trigger-pulse' : ''}
        >
          {config.icon}
        </div>
      </Badge>
    </Tooltip>
  );
};

export { ChatTrigger };
