/**
 * TopSlowRuns - Top 5 慢速运行列表
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Card, List, Row, Col, Progress, Typography, Empty } from 'antd';
import { colors } from '@/tokens';
import type { RunRecord, PipelineSummary, RunStats } from './types';
import { formatDuration, toNumberMs } from './constants';

const { Text } = Typography;

export interface TopSlowRunsProps {
  topSlow: RunRecord[];
  pipelines: PipelineSummary[];
  stats: RunStats;
}

export const TopSlowRuns: React.FC<TopSlowRunsProps> = ({ topSlow, pipelines, stats }) => (
  <Card title="Top 5 慢速运行" style={{ height: 220 }}>
    {topSlow.length > 0 ? (
      <List
        size="small"
        dataSource={topSlow}
        renderItem={(r) => {
          const dur = toNumberMs(r.durationMs);
          const p = pipelines.find((pl) => pl.id === r.pipelineId);
          return (
            <List.Item>
              <Row style={{ width: '100%' }} align="middle">
                <Col span={10}>
                  <Text strong>{p?.name || r.pipelineId}</Text>
                </Col>
                <Col span={6}>
                  <Text code>{formatDuration(dur)}</Text>
                </Col>
                <Col span={8}>
                  <Progress
                    percent={
                      stats.maxDurationMs > 0
                        ? Math.round((dur / stats.maxDurationMs) * 100)
                        : 0
                    }
                    size="small"
                    showInfo={false}
                    strokeColor={
                      dur > stats.avgDurationMs * 2 ? colors.error[500] : colors.primary[500]
                    }
                  />
                </Col>
              </Row>
            </List.Item>
          );
        }}
      />
    ) : (
      <Empty description="无数据" />
    )}
  </Card>
);
