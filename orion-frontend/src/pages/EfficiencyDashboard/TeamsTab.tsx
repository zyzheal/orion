/**
 * TeamsTab.tsx - 团队对比 Tab (自包含)
 * 抽取自 EfficiencyDashboard/index.tsx (P2-9 Phase 79)
 */
import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Select } from 'antd';
import { colors, spacing } from '@/tokens';
import { DORA_LEVELS } from '@/constants/dora-guidance';
import { getTeamComparison } from '@/api/efficiency';
import type { TeamInfo, TeamMetrics } from '@/api/efficiency';

const { Text } = Typography;

interface TeamsTabProps {
  teams: TeamInfo[];
}

export const TeamsTab: React.FC<TeamsTabProps> = ({ teams }) => {
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [teamComparison, setTeamComparison] = useState<TeamMetrics[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setComparisonLoading(true);
      try {
        const res = await getTeamComparison({
          teamIds: selectedTeams.length > 0 ? selectedTeams.join(',') : undefined,
          interval: 'weekly',
        });
        if (!cancelled) setTeamComparison(res.data?.teams || []);
      } catch {
        if (!cancelled) setTeamComparison([]);
      } finally {
        if (!cancelled) setComparisonLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedTeams]);

  return (
    <Card title="团队效能对比">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text type="secondary" style={{ marginRight: spacing.sm }}>
            选择对比团队：
          </Text>
          <Select
            mode="multiple"
            style={{ width: 400 }}
            placeholder="选择要对比的团队"
            value={selectedTeams}
            onChange={(values) => setSelectedTeams(values)}
            options={teams.map((t) => ({ label: t.teamName, value: t.teamId }))}
            allowClear
          />
        </div>

        {teamComparison.length > 0 && (
          <Table
            dataSource={teamComparison}
            rowKey="teamId"
            loading={comparisonLoading}
            pagination={false}
            columns={[
              {
                title: '排名',
                key: 'rank',
                width: 60,
                render: (_: unknown, __: unknown, index: number) => index + 1,
              },
              {
                title: '团队',
                dataIndex: 'teamName',
                key: 'teamName',
              },
              {
                title: '等级',
                dataIndex: 'level',
                key: 'level',
                render: (level: string) => {
                  const levelInfo = DORA_LEVELS.find((l) => l.level === level);
                  return (
                    <Tag color={levelInfo?.color || colors.neutral[500]}>
                      {levelInfo?.name || level}
                    </Tag>
                  );
                },
              },
              {
                title: '评分',
                dataIndex: 'score',
                key: 'score',
                render: (score: number) => <Text strong>{score}</Text>,
              },
              {
                title: '部署频率',
                key: 'deploymentFrequency',
                render: (record: TeamMetrics) =>
                  `${record.metrics.deploymentFrequency?.toFixed(1) || '-'} 次/周`,
              },
              {
                title: '前置时间',
                key: 'leadTime',
                render: (record: TeamMetrics) =>
                  record.metrics.leadTimeMinutes
                    ? `${record.metrics.leadTimeMinutes.toFixed(1)} min`
                    : '-',
              },
              {
                title: 'MTTR',
                key: 'mttr',
                render: (record: TeamMetrics) =>
                  record.metrics.mttrMinutes
                    ? `${record.metrics.mttrMinutes.toFixed(1)} min`
                    : '-',
              },
              {
                title: '失败率',
                key: 'failureRate',
                render: (record: TeamMetrics) =>
                  `${record.metrics.changeFailureRate?.toFixed(1) || '-'}%`,
              },
            ]}
          />
        )}

        {teamComparison.length === 0 && !comparisonLoading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">暂无团队数据，请等待部署记录积累</Text>
          </div>
        )}
      </Space>
    </Card>
  );
};
