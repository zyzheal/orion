/**
 * LogsTab.tsx - 执行日志 Tab
 * 抽取自 pipeline-svc/PipelineDetail/index.tsx (P2-9 Phase 103)
 */
import React from 'react';
import { colors, spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import type { PipelineDetailModel, StageDetail } from '../types';
import { stageStatusColors } from '../constants';


interface LogsTabProps {
  pipeline: PipelineDetailModel;
}

export const LogsTab: React.FC<LogsTabProps> = ({ pipeline }) => {
  const isRunning = pipeline.status === 'running';
  return (
    <CardPanel title="日志输出">
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
        {pipeline.stages?.map((stage: StageDetail) => (
          <div key={stage.name} style={{ marginBottom: spacing.md }}>
            <div
              style={{
                color: stageStatusColors[stage.status],
                fontWeight: 600,
                marginBottom: spacing.sm,
                borderBottom: '1px solid colors.neutral[800]',
                paddingBottom: 4,
              }}
            >
              [{new Date(stage.startTime || pipeline.startTime || 0).toLocaleTimeString('zh-CN', { hour12: false })}] === Stage:{' '}
              {stage.name} ===
            </div>
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
        {isRunning && (
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 16,
              backgroundColor: colors.neutral[300],
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>
    </CardPanel>
  );
};
