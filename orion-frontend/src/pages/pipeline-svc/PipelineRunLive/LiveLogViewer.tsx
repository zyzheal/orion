/**
 * LiveLogViewer - 实时日志查看器
 * 抽取自 index.tsx（P2-9 Phase 36）
 *
 * - 自动滚动到底部（新日志到达时）
 * - 关键字搜索高亮 + 过滤
 * - 空态展示 + 闪烁光标
 */
import React, { useEffect, useRef } from 'react';
import { Tag, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { LogEntry } from './types';
import { logLevelColors, logLevelLabels, formatTime, escapeRegExp } from './constants';

const { Text } = Typography;

export interface LiveLogViewerProps {
  logs: LogEntry[];
  autoScroll: boolean;
  searchText: string;
}

function highlightSearch(text: string, search: string): React.ReactNode {
  if (!search) return text;
  const escaped = escapeRegExp(search);
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  const matchRegex = new RegExp(escaped, 'i');
  return parts.map((part, i) =>
    matchRegex.test(part) ? (
      <span
        key={String(i)}
        style={{
          background: colors.warning[200],
          color: colors.neutral[900],
          borderRadius: 2,
          padding: '0 2px',
        }}
      >
        {part}
      </span>
    ) : (
      part
    )
  );
}

export const LiveLogViewer: React.FC<LiveLogViewerProps> = ({ logs, autoScroll, searchText }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLogCountRef = useRef(0);

  useEffect(() => {
    if (autoScroll && logs.length > prevLogCountRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLogCountRef.current = logs.length;
  }, [logs.length, autoScroll]);

  if (logs.length === 0) {
    return (
      <div
        style={{
          background: colors.neutral[900],
          borderRadius: 6,
          padding: '40px 16px',
          textAlign: 'center',
          color: colors.neutral[500],
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          fontSize: spacing[3],
        }}
      >
        <LoadingOutlined style={{ fontSize: 24, marginBottom: spacing[3] }} />
        <div>等待日志推送...</div>
        <Text type="secondary" style={{ fontSize: spacing[2] }}>
          SSE 连接建立后将实时显示日志
        </Text>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: colors.neutral[900],
        borderRadius: 6,
        padding: spacing[3],
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.6,
        maxHeight: 500,
        overflowY: 'auto',
        color: colors.neutral[300],
      }}
    >
      {logs.map((log) => {
        const textColor = logLevelColors[log.level] || colors.neutral[300];
        if (searchText && !log.text.toLowerCase().includes(searchText.toLowerCase())) {
          return null;
        }
        return (
          <div key={log.id} style={{ display: 'flex', gap: spacing.sm }}>
            <span style={{ color: colors.neutral[500], flexShrink: 0, userSelect: 'none' }}>
              {formatTime(log.timestamp)}
            </span>
            <span style={{ color: textColor, fontWeight: 600, flexShrink: 0, minWidth: 48 }}>
              [{logLevelLabels[log.level]}]
            </span>
            {log.stepName && (
              <Tag
                color="blue"
                style={{ margin: 0, fontSize: 10, lineHeight: '18px', height: 18, flexShrink: 0 }}
              >
                {log.stepName}
              </Tag>
            )}
            <span style={{ color: textColor, wordBreak: 'break-word' }}>
              {highlightSearch(log.text, searchText)}
            </span>
          </div>
        );
      })}
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 16,
          backgroundColor: colors.neutral[300],
          animation: 'blink 1s step-end infinite',
          marginTop: 4,
        }}
      />
    </div>
  );
};
