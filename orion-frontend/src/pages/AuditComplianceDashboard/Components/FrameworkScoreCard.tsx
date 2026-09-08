/**
 * FrameworkScoreCard (Phase 305)
 *
 * Displays a single framework's compliance score with a colored rating
 * badge, a pass/fail progress ring, and a small control-pass stat.
 *
 * Rating thresholds (mirror backend service.ratingFromScore):
 *   ≥ 90 → compliant  (green)
 *   ≥ 70 → partial    (amber)
 *   else → non-compliant (red)
 */
import React from 'react';
import { Card, Progress, Statistic, Tag } from 'antd';
import {
  CheckCircleTwoTone,
  WarningTwoTone,
  CloseCircleTwoTone,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { FrameworkScore } from '@/api/audit-compliance';

type RatingKey = 'compliant' | 'partial' | 'non-compliant';

const RATING_META: Record<
  RatingKey,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  compliant: {
    label: '合规',
    color: colors.success[700],
    bg: colors.success[50],
    icon: <CheckCircleTwoTone twoToneColor={colors.success[500]} />,
  },
  partial: {
    label: '部分合规',
    color: colors.warning[700],
    bg: colors.warning[50],
    icon: <WarningTwoTone twoToneColor={colors.warning[500]} />,
  },
  'non-compliant': {
    label: '不合规',
    color: colors.error[700],
    bg: colors.error[50],
    icon: <CloseCircleTwoTone twoToneColor={colors.error[500]} />,
  },
};

export interface FrameworkScoreCardProps {
  score: FrameworkScore;
}

export const FrameworkScoreCard: React.FC<FrameworkScoreCardProps> = ({ score }) => {
  const meta = RATING_META[score.rating] ?? RATING_META.partial;
  const percent = score.totalControls > 0
    ? Math.round((score.passedControls / score.totalControls) * 100)
    : 0;

  return (
    <Card
      size="small"
      styles={{ body: { padding: spacing.md } }}
      style={{
        borderColor: meta.color,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderLeftColor: meta.color,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          <span style={{ marginRight: 6 }}>{meta.icon}</span>
          {score.framework}
        </div>
        <Tag
          color={meta.bg}
          style={{
            color: meta.color,
            borderColor: meta.color,
            background: meta.bg,
            margin: 0,
          }}
        >
          {meta.label}
        </Tag>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <Progress
          type="circle"
          percent={percent}
          size={64}
          strokeColor={meta.color}
          trailColor={colors.neutral[100]}
          format={(p) => (
            <span style={{ color: meta.color, fontWeight: 600, fontSize: 14 }}>
              {score.score.toFixed(1)}
            </span>
          )}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: colors.neutral[600] }}>Controls 通过</span>
            <span style={{ fontWeight: 600 }}>
              {score.passedControls}
              <span style={{ color: colors.neutral[400], fontWeight: 400 }}>
                {' / '}
                {score.totalControls}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
            <span style={{ color: colors.neutral[600] }}>Controls 未通过</span>
            <span style={{ color: score.failedControls > 0 ? colors.error[500] : colors.neutral[400], fontWeight: 600 }}>
              {score.failedControls}
            </span>
          </div>
        </div>
      </div>

      {score.totalControls > 0 && (
        <div style={{ marginTop: spacing.sm }}>
          <Statistic
            value={percent}
            suffix="%"
            valueStyle={{ fontSize: 13, color: colors.neutral[600] }}
            prefix={<span style={{ color: colors.neutral[500], fontWeight: 400 }}>通过率</span>}
          />
        </div>
      )}
    </Card>
  );
};
