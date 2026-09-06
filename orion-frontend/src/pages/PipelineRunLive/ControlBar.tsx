/**
 * ControlBar - 日志控制栏
 * 抽取自 index.tsx（P2-9 Phase 37）
 */
import React from 'react';
import { Button, Divider, Typography } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { spacing, themeVars } from '@/tokens';

const { Text } = Typography;

export interface ControlBarProps {
  isPaused: boolean;
  handlePause: () => void;
  handleClearLogs: () => void;
  handleExportLogs: () => void;
  handleReconnect: () => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  logCount: number;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isPaused,
  handlePause,
  handleClearLogs,
  handleExportLogs,
  handleReconnect,
  autoScroll,
  setAutoScroll,
  logCount,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      padding: '8px 12px',
      background: themeVars.bgTertiary,
      borderRadius: 6,
    }}
  >
    <Button
      size="small"
      icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
      onClick={handlePause}
      title={isPaused ? '恢复日志流' : '暂停日志流'}
    >
      {isPaused ? '恢复' : '暂停'}
    </Button>
    <Button size="small" icon={<ClearOutlined />} onClick={handleClearLogs} title="清空日志">
      清空日志
    </Button>
    <Button size="small" icon={<DownloadOutlined />} onClick={handleExportLogs} title="导出日志">
      导出日志
    </Button>
    <Divider type="vertical" />
    <Button
      size="small"
      type={autoScroll ? 'primary' : 'default'}
      onClick={() => setAutoScroll(!autoScroll)}
      title={autoScroll ? '关闭自动滚动' : '开启自动滚动'}
    >
      {autoScroll ? '自动滚动: 开' : '自动滚动: 关'}
    </Button>
    <Divider type="vertical" />
    <Button
      size="small"
      icon={<SyncOutlined />}
      onClick={handleReconnect}
      title="重新连接 SSE"
    >
      重连
    </Button>
    <div style={{ marginLeft: 'auto' }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        日志数: {logCount}
      </Text>
    </div>
  </div>
);
