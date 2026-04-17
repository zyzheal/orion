/**
 * FooterProgressBar Component
 *
 * Displays active session progress in the application footer.
 * Shows session name with type-specific icon, progress bar, status badge,
 * and optional message. Auto-hides when no active sessions.
 */
import React, { useState, useMemo } from 'react';
import { Layout as AntLayout, Progress, Badge, Tag, Typography } from 'antd';
import {
  RobotOutlined,
  RocketOutlined,
  CloudServerOutlined,
  BuildOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { useSessionStore, SessionProgress } from '@/stores/sessionStore';
import { useAppStore } from '@/stores/appStore';

const { Footer } = AntLayout;
const { Text } = Typography;

// ============================================================================
// Type-specific icon mapping
// ============================================================================

const sessionIconMap: Record<SessionProgress['type'], React.ReactNode> = {
  agent: <RobotOutlined />,
  pipeline: <RocketOutlined />,
  deployment: <CloudServerOutlined />,
  build: <BuildOutlined />,
};

// ============================================================================
// Status configuration
// ============================================================================

interface StatusConfig {
  color: string;
  icon: React.ReactNode;
  label: string;
  progressStrokeColor: string;
}

const statusConfigMap: Record<SessionProgress['status'], StatusConfig> = {
  running: {
    color: '#1890ff',
    icon: <LoadingOutlined />,
    label: 'Running',
    progressStrokeColor: '#1890ff',
  },
  completed: {
    color: '#52c41a',
    icon: <CheckCircleOutlined />,
    label: 'Completed',
    progressStrokeColor: '#52c41a',
  },
  failed: {
    color: '#ff4d4f',
    icon: <CloseCircleOutlined />,
    label: 'Failed',
    progressStrokeColor: '#ff4d4f',
  },
  paused: {
    color: '#faad14',
    icon: <PauseCircleOutlined />,
    label: 'Paused',
    progressStrokeColor: '#faad14',
  },
};

// ============================================================================
// Inline styles for the footer bar animations
// ============================================================================

const pulseKeyframes = `
  @keyframes footer-progress-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

let styleInjected = false;
function injectFooterStyles() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
  styleInjected = true;
}

// ============================================================================
// SessionItem: individual session row (collapsed + expanded)
// ============================================================================

interface SessionItemProps {
  session: SessionProgress;
  expanded: boolean;
  onToggle: () => void;
  theme: 'light' | 'dark';
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  expanded,
  onToggle,
  theme,
}) => {
  const { updateSession } = useSessionStore();
  const statusConfig = statusConfigMap[session.status];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 0',
    cursor: 'pointer',
    minWidth: 0,
    flex: 1,
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 14,
    color: statusConfig.color,
    flexShrink: 0,
  };

  const nameStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 500,
    color: theme === 'dark' ? '#e0e0e0' : '#333',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    maxWidth: expanded ? '200px' : '120px',
    flexShrink: 1,
  };

  const progressWrapperStyle: React.CSSProperties = {
    flex: 1,
    minWidth: expanded ? '100px' : '60px',
    maxWidth: expanded ? '200px' : '100px',
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 11,
    color: theme === 'dark' ? '#999' : '#666',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '150px',
  };

  const toggleIconStyle: React.CSSProperties = {
    fontSize: 10,
    color: theme === 'dark' ? '#999' : '#666',
    flexShrink: 0,
    transition: 'transform 0.2s',
  };

  const completedProgress = session.status === 'completed' ? 100 : session.progress;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: expanded ? 4 : 0,
        ...containerStyle,
      }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      title={`${session.name} - ${statusConfig.label}`}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={iconStyle}>
          {sessionIconMap[session.type]}
        </span>
        <span style={nameStyle}>{session.name}</span>
        <div style={progressWrapperStyle}>
          <Progress
            percent={completedProgress}
            size="small"
            strokeColor={statusConfig.progressStrokeColor}
            showInfo={false}
            status={session.status === 'failed' ? 'exception' : undefined}
          />
        </div>
        <Badge
          status="processing"
          color={statusConfig.color}
          text={null}
          style={{
            animation: session.status === 'running'
              ? 'footer-progress-pulse 1.5s ease-in-out infinite'
              : 'none',
          }}
        />
        <span style={toggleIconStyle}>
          {expanded ? <UpOutlined /> : <DownOutlined />}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 22,
            paddingTop: 2,
          }}
        >
          <Tag color={statusConfig.color} style={{ margin: 0, fontSize: 10, padding: '0 6px' }}>
            {statusConfig.label}
          </Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {completedProgress}%
          </Text>
          {session.message && (
            <Text style={messageStyle} title={session.message}>
              {session.message}
            </Text>
          )}
          {session.status === 'completed' && (
            <span
              style={{ fontSize: 10, cursor: 'pointer', color: '#52c41a' }}
              onClick={(e) => {
                e.stopPropagation();
                updateSession(session.id, { status: 'failed' });
              }}
              title="Mark as failed"
            >
              Undo
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// FooterProgressBar Component
// ============================================================================

const FooterProgressBar: React.FC = () => {
  const { sessions, getActiveSessions } = useSessionStore();
  const { theme } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  injectFooterStyles();

  const activeSessions = useMemo(() => getActiveSessions(), [getActiveSessions]);

  const displaySessions = useMemo(() => {
    if (activeSessions.length > 0) return activeSessions;
    if (sessions.length > 0) return sessions;
    return [];
  }, [activeSessions, sessions]);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Auto-hide when no sessions at all
  if (displaySessions.length === 0) {
    return (
      <Footer
        style={{
          textAlign: 'center',
          background: 'transparent',
          color: theme === 'dark' ? '#666' : '#999',
          padding: '12px 24px',
        }}
      >
        Orion Platform ©{new Date().getFullYear()} Created by Orion Team
      </Footer>
    );
  }

  const footerContainerStyle: React.CSSProperties = {
    background: theme === 'dark' ? '#1a1a1a' : '#fafafa',
    borderTop: `1px solid ${theme === 'dark' ? '#333' : '#e8e8e8'}`,
    padding: '6px 24px',
    transition: 'all 0.3s ease',
  };

  const sessionCountStyle: React.CSSProperties = {
    fontSize: 11,
    color: theme === 'dark' ? '#999' : '#666',
    flexShrink: 0,
    marginRight: 12,
    fontWeight: 500,
  };

  return (
    <Footer style={footerContainerStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'nowrap',
          overflowX: 'auto',
        }}
      >
        {/* Session count badge */}
        <span style={sessionCountStyle}>
          <Badge
            count={activeSessions.length}
            size="small"
            style={{ backgroundColor: '#1890ff' }}
          />
          <span style={{ marginLeft: 4 }}>
            {activeSessions.length > 0
              ? `${activeSessions.length} active`
              : `${displaySessions.length} session(s)`}
          </span>
        </span>

        {/* Session items */}
        {displaySessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            expanded={expandedId === session.id}
            onToggle={() => handleToggle(session.id)}
            theme={theme}
          />
        ))}

        {/* Copyright on the right */}
        <span
          style={{
            fontSize: 11,
            color: theme === 'dark' ? '#666' : '#bbb',
            marginLeft: 'auto',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Orion Platform ©{new Date().getFullYear()}
        </span>
      </div>
    </Footer>
  );
};

export default FooterProgressBar;
