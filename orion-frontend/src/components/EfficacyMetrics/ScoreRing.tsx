import React from 'react';
import { Typography, Progress } from 'antd';
import { spacing } from '@/tokens';
import { aggregateScores, scoreToLevel } from '@/utils/efficacyScore';
import type { DomainKey } from '@/utils/efficacyScore';

const { Title, Text } = Typography;

export interface ScoreRingProps {
  domainScores: Record<DomainKey, number>;
  loading?: boolean;
}

/**
 * 整体评分环组件
 * 使用 Ant Design Progress 的 circular 模式展示 0-100 综合评分
 */
const ScoreRing: React.FC<ScoreRingProps> = ({ domainScores, loading = false }) => {
  if (loading) {
    return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Progress type="circle" size={150} strokeColor="rgba(51,112,230,0.1)" percent={0} /></div>;
  }

  const { overall, level: _level, label, color: _color } = aggregateScores(domainScores);
  const { color: levelColor } = scoreToLevel(overall);

  return (
    <div style={{ textAlign: 'center', padding: spacing.md }}>
      <Progress
        type="circle"
        percent={overall}
        size={150}
        strokeColor={levelColor}
        trailColor="rgba(51,112,230,0.06)"
        strokeWidth={12}
        format={(pct) => <span style={{ fontSize: 28, fontWeight: 600, color: levelColor }}>{pct}</span>}
      />
      <Title level={4} style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
        {label}
      </Title>
      <Text type="secondary" style={{ fontSize: 13 }}>
        六域综合评分 · DORA Benchmark 对照
      </Text>
      <div style={{ marginTop: spacing.md, display: 'flex', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#52c41a' }} />
          <Text style={{ fontSize: 12 }} type="secondary">Elite ≥ 80</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3370E6' }} />
          <Text style={{ fontSize: 12 }} type="secondary">High ≥ 60</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#faad14' }} />
          <Text style={{ fontSize: 12 }} type="secondary">Medium ≥ 40</Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f5222d' }} />
          <Text style={{ fontSize: 12 }} type="secondary">Low {'<'} 40</Text>
        </div>
      </div>
    </div>
  );
};

export default ScoreRing;
