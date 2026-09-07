/**
 * UEBA Risk Rank Card (Top 5 高风险用户)
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import React from 'react';
import { Card, Space, Progress, Empty, Typography } from 'antd';
import { WarningOutlined, UserOutlined } from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import type { UserRiskRank } from '../types';
import { plainCardStyle, commonStyle } from '../constants';
import { getScoreColor } from '../helpers';

const { Text } = Typography;

interface RiskRankCardProps {
  riskRanks: UserRiskRank[];
}

const renderRankItem = (user: UserRiskRank, index: number) => {
  const scoreColor = getScoreColor(user.score);
  return (
    <div
      key={user.key}
      style={
        {
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: 8,
          backgroundColor: index === 0 ? colors.error[50] : themeVars.bgSecondary,
          border: index === 0 ? `1px solid ${colors.error[100]}` : 'none',
        } as React.CSSProperties
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Space size={8}>
          <Text
            strong
            style={
              {
                fontSize: 14,
                color: index < 3 ? scoreColor : commonStyle.neutral,
              } as React.CSSProperties
            }
          >
            #{index + 1}
          </Text>
          <UserOutlined style={{ color: scoreColor }} />
          <Text strong>{user.username}</Text>
        </Space>
        <Space size={4}>
          <Text type="secondary">异常 {user.count} 次</Text>
          <Text strong style={{ color: scoreColor }}>
            {user.score}
          </Text>
        </Space>
      </div>
      <Progress
        percent={user.score}
        strokeColor={scoreColor}
        trailColor={colors.neutral[100]}
        showInfo={false}
      />
    </div>
  );
};

export const RiskRankCard: React.FC<RiskRankCardProps> = ({ riskRanks }) => (
  <Card
    title={
      <Space>
        <WarningOutlined />
        <span>Top 5 高风险用户</span>
      </Space>
    }
    style={plainCardStyle}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
      {riskRanks.length > 0
        ? riskRanks.map((user, index) => renderRankItem(user, index))
        : <Empty
            description="UEBA 风险排行数据尚未接入"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />}
    </div>
  </Card>
);
