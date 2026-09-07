/**
 * Personal Overview Card
 * 抽取自 index.tsx (P2-9 Phase 129)
 */
import React from 'react';
import { Row, Col, Tag, Space, Typography } from 'antd';
import {
  UserOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import CardPanel from '@/components/CardPanel';
import { StatCard } from '@/components/charts';
import { spacing } from '@/tokens';
import type { EngineerDashboardData } from '@/types/pages';
import { COLORS, gradeColorMap } from '../constants';

const { Title, Text } = Typography;

interface PersonalOverviewCardProps {
  data: EngineerDashboardData;
}

export const PersonalOverviewCard: React.FC<PersonalOverviewCardProps> = ({ data }) => {
  const recentTrend = data.personalTrend.slice(-14);

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <CardPanel>
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Space direction="vertical" size={8}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: `${COLORS.purple}15`,
                    color: COLORS.purple,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: spacing[6],
                  }}
                >
                  <UserOutlined />
                </div>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {data.personalOverview.engineerName}
                  </Title>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {data.personalOverview.engineerId}
                  </Text>
                </div>
              </div>
              <Space size={12}>
                <Tag
                  color="gold"
                  icon={<TrophyOutlined />}
                  style={{ fontWeight: 700, fontSize: spacing[4], padding: '4px 12px' }}
                >
                  排名 #{data.personalOverview.rank}/{data.personalOverview.totalInTeam}
                </Tag>
                <Tag
                  color={
                    gradeColorMap[data.personalOverview.performanceGrade] || 'default'
                  }
                  style={{ fontWeight: 700, fontSize: spacing[4], padding: '4px 12px' }}
                >
                  等级 {data.personalOverview.performanceGrade}
                </Tag>
              </Space>
            </Space>
          </Col>

          <Col xs={24} sm={16} md={18}>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <StatCard
                  title="当前负载"
                  value={data.personalOverview.currentLoad}
                  suffix="个"
                  icon={<ClockCircleOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <StatCard
                  title="已解决总数"
                  value={data.personalOverview.totalResolved}
                  suffix="个"
                  icon={<CheckCircleOutlined />}
                  trend={{ value: 12, direction: 'up', good: 'up' }}
                  sparklineData={recentTrend.map((d) => d.resolved)}
                />
              </Col>
              <Col xs={12} sm={6}>
                <StatCard
                  title="平均解决时间"
                  value={data.personalOverview.avgResolutionTimeHours}
                  suffix="h"
                  icon={<ThunderboltOutlined />}
                  trend={{ value: 5, direction: 'down', good: 'down' }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <StatCard
                  title="SLA合规率"
                  value={data.personalOverview.slaComplianceRate}
                  suffix="%"
                  icon={<FlagOutlined />}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </CardPanel>
    </div>
  );
};
