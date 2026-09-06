/**
 * ControlBar - 日志控制栏
 * 抽取自 index.tsx（P2-9 Phase 36）
 */
import React from 'react';
import { Button, Input, Switch, Divider, Typography } from 'antd';
import {
  SearchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';

const { Text } = Typography;

export interface ControlBarProps {
  searchText: string;
  setSearchText: (v: string) => void;
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  isPaused: boolean;
  handlePause: () => void;
  handleClearLogs: () => void;
  handleExportLogs: () => void;
  handleReconnect: () => void;
  displayLogs: { text: string }[];
}

export const ControlBar: React.FC<ControlBarProps> = ({
  searchText,
  setSearchText,
  autoScroll,
  setAutoScroll,
  isPaused,
  handlePause,
  handleClearLogs,
  handleExportLogs,
  handleReconnect,
  displayLogs,
}) => {
  const matchCount = searchText
    ? displayLogs.filter((l) => l.text.toLowerCase().includes(searchText.toLowerCase())).length
    : 0;

  return (
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
      <Input
        prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
        placeholder="搜索日志关键字..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ width: 220 }}
        allowClear
        size="small"
      />
      <Switch
        checked={autoScroll}
        onChange={setAutoScroll}
        checkedChildren="自动滚动"
        unCheckedChildren="手动查看"
        size="small"
      />
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
        icon={<SyncOutlined />}
        onClick={handleReconnect}
        title="重新连接 SSE"
      >
        重连
      </Button>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        {searchText && (
          <Text style={{ fontSize: 12, color: colors.primary[500] }}>
            匹配:{' '}
            {matchCount}{' '}
            条
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 12 }}>
          日志数: {displayLogs.length}
        </Text>
      </div>
    </div>
  );
};
