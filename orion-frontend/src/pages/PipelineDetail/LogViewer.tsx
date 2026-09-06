/**
 * Log Viewer
 * 执行日志 Tab 内容（抽取自 index.tsx）
 */
import React from 'react';
import { Card } from 'antd';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import { stageStatusColors } from './constants';
import type { PipelineStage, PipelineDisplay } from './types';

export interface LogViewerProps {
  pipeline: PipelineDisplay;
}

export const LogViewer: React.FC<LogViewerProps> = ({ pipeline }) => (
  <Card style={{ marginBottom: spacing.lg }} title="日志输出">
    <div
      style={{
        background: colors.neutral[900],
        borderRadius: 6,
        padding: spacing.md,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: spacing[3],
        lineHeight: 1.6,
        maxHeight: 500,
        overflowY: 'auto',
        color: colors.neutral[300],
      }}
    >
      {pipeline.stages?.map((stage: PipelineStage) => (
        <div key={stage.name} style={{ marginBottom: spacing.md }}>
          {/* Stage header */}
          <div
            style={{
              color: stageStatusColors[stage.status],
              fontWeight: 600,
              marginBottom: spacing.sm,
              borderBottom: '1px solid colors.neutral[800]',
              paddingBottom: 4,
            }}
          >
            [{dayjs(stage.startTime || pipeline.startTime).format('HH:mm:ss')}] === Stage:{' '}
            {stage.name} ===
          </div>
          {/* Stage logs */}
          {stage.logs && stage.logs.length > 0 ? (
            stage.logs.map((log: string, index: number) => (
              <div key={String(index)} style={{ paddingLeft: spacing.md }}>
                {log.includes('FAIL') ? (
                  <span style={{ color: colors.error[500] }}>{log}</span>
                ) : log.includes('passed') ||
                  log.includes('successful') ||
                  log.includes('Success') ? (
                  <span style={{ color: colors.success[600] }}>{log}</span>
                ) : (
                  log
                )}
              </div>
            ))
          ) : (
            <div style={{ paddingLeft: spacing.md, color: colors.neutral[500] }}>
              {stage.status === 'pending' ? '[Waiting to start...]' : '[No logs available]'}
            </div>
          )}
        </div>
      ))}
      {/* Cursor indicator */}
      {pipeline.status === 'running' && (
        <span
          style={
            {
              display: 'inline-block',
              width: 8,
              height: 16,
              backgroundColor: colors.neutral[300],
              animation: 'blink 1s step-end infinite',
            } as React.CSSProperties
          }
        />
      )}
    </div>
  </Card>
);
