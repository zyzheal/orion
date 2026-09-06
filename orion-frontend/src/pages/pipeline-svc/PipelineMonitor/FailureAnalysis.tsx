/**
 * FailureAnalysis
 * 失败模式分布 + 失败阶段 Top 5 双列面板
 * 抽取自 index.tsx
 */
import React from 'react';
import { Row, Col, Empty } from 'antd';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import type { RunStats } from './api';
import type { FailedStageStat } from './api';
import type { PipelineRunSummary } from '@/api/pipelineRuns';

export interface FailureAnalysisProps {
  failedRuns: PipelineRunSummary[];
  failedStageStats: FailedStageStat[];
  stats: RunStats | null;
}

export const FailureAnalysis: React.FC<FailureAnalysisProps> = ({
  failedRuns,
  failedStageStats,
  stats,
}) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col xs={24} lg={12}>
      <CardPanel title="失败模式分布">
        {failedRuns.length > 0 ? (
          <div>
            <div style={{ marginBottom: spacing.sm }}>
              <span style={{ fontSize: 24, fontWeight: 600, color: colors.error[500] }}>
                {failedRuns.length}
              </span>
              <span style={{ marginLeft: spacing.sm, color: colors.neutral[500] }}>
                次失败 (
                {stats?.totalRuns
                  ? ((failedRuns.length / stats.totalRuns) * 100).toFixed(1)
                  : 0}
                %)
              </span>
            </div>
            {/* 简化版进度条展示 */}
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stats?.totalRuns ? stats.successRate : 0}%`,
                  background: colors.success[500],
                  transition: 'width 300ms ease',
                }}
              />
              <div
                style={{
                  width: `${stats?.totalRuns ? ((stats.failedCount || 0) / stats.totalRuns) * 100 : 0}%`,
                  background: colors.error[500],
                  transition: 'width 300ms ease',
                }}
              />
              <div
                style={{
                  flex: 1,
                  background: colors.neutral[200],
                  transition: 'width 300ms ease',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: spacing.xs,
                fontSize: 12,
              }}
            >
              <span style={{ color: colors.success[500] }}>成功</span>
              <span style={{ color: colors.error[500] }}>失败</span>
            </div>
          </div>
        ) : (
          <Empty description="暂无失败记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </CardPanel>
    </Col>
    <Col xs={24} lg={12}>
      <CardPanel title="失败阶段 Top 5">
        {failedStageStats.length > 0 ? (
          <div>
            {failedStageStats.map((item, index) => (
              <div
                key={item.stageName}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: `${spacing.xs} 0`,
                  borderBottom:
                    index < failedStageStats.length - 1
                      ? `1px solid ${colors.neutral[200]}`
                      : 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: index < 3 ? colors.error[500] : colors.neutral[300],
                      color: colors.neutral[0],
                      fontSize: 12,
                      marginRight: spacing.sm,
                    }}
                  >
                    {index + 1}
                  </span>
                  <span
                    style={{
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.stageName}
                  </span>
                </span>
                <span style={{ fontWeight: 500, color: colors.error[500] }}>
                  {item.count} 次
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无失败数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </CardPanel>
    </Col>
  </Row>
);
