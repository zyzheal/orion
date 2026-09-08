/**
 * DomainCards - 六大域卡片
 * 抽取自 index.tsx (P2-9 Phase 212)
 */
import { Row, Col } from 'antd';
import {
  CloudUploadOutlined,
  TeamOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import type { DomainKey } from '@/utils/efficacyScore';
import { colors, spacing } from '@/tokens';
import DomainCard from '@/components/EfficacyMetrics/DomainCard';

interface Props {
  domainScores: Record<DomainKey, number>;
  e2eMetrics: { deliveryCycle: number; successRate: number };
  engMetrics: { doraLevel: string; failureRate: number; deployments: number };
  aiMetrics: { adoption: number; completion: number };
  mgmtMetrics: { teams: number; avgScore: number };
  riskMetrics: { high: number; score: number };
}

export const DomainCards = ({
  domainScores,
  e2eMetrics,
  engMetrics,
  aiMetrics,
  mgmtMetrics,
  riskMetrics,
}: Props) => {
  const domainCards = [
    {
      key: 'e2e',
      title: '端到端链路',
      icon: <CloudUploadOutlined />,
      primaryValue: domainScores.e2e,
      primaryLabel: '交付成功率 (%)',
      secondaryItems: [{ label: '平均交付周期', value: `${e2eMetrics.deliveryCycle}h` }],
      trend: 'up' as const,
      trendPercent: 5,
      color: colors.primary[500],
      link: '/efficacy-metrics/e2e',
    },
    {
      key: 'management',
      title: '管理域',
      icon: <TeamOutlined />,
      primaryValue: domainScores.management,
      primaryLabel: '团队综合评分',
      secondaryItems: [{ label: '活跃团队', value: mgmtMetrics.teams }],
      trend: 'up' as const,
      trendPercent: 2,
      color: colors.success[500],
      link: '/efficacy-metrics/management',
    },
    {
      key: 'engineering',
      title: '工程域',
      icon: <BarChartOutlined />,
      primaryValue: domainScores.engineering,
      primaryLabel: 'DORA 综合等级',
      secondaryItems: [
        { label: '变更失败率', value: `${engMetrics.failureRate}%` },
        { label: '部署数', value: engMetrics.deployments },
      ],
      trend: 'up' as const,
      trendPercent: 8,
      color: colors.purple[500],
      link: '/efficacy-metrics/engineering',
    },
    {
      key: 'compliance',
      title: '合规域',
      icon: <CheckCircleOutlined />,
      primaryValue: domainScores.compliance,
      primaryLabel: '合规率 (%)',
      secondaryItems: [{ label: 'SLA 达成', value: '98%' }],
      trend: 'stable' as const,
      trendPercent: 0,
      color: colors.warning[500],
      link: '/efficacy-metrics/compliance',
    },
    {
      key: 'aiEfficiency',
      title: 'AI 智研提效',
      icon: <RocketOutlined />,
      primaryValue: domainScores.aiEfficiency,
      primaryLabel: 'AI 采纳率 (%)',
      secondaryItems: [{ label: 'Agent 完成率', value: `${aiMetrics.completion}%` }],
      trend: 'up' as const,
      trendPercent: 12,
      color: colors.info[500],
      link: '/efficacy-metrics/ai-efficiency',
    },
    {
      key: 'risk',
      title: '风险看板',
      icon: <AlertOutlined />,
      primaryValue: domainScores.risk,
      primaryLabel: '系统弹性评分',
      secondaryItems: [{ label: '高危风险', value: riskMetrics.high }],
      trend: riskMetrics.high > 0 ? ('down' as const) : ('up' as const),
      trendPercent: riskMetrics.high > 0 ? riskMetrics.high * 3 : 0,
      color: colors.error[500],
      link: '/efficacy-metrics/risk',
    },
  ];

  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      {domainCards.map((card) => (
        <Col span={8} key={card.key}>
          <DomainCard {...card} />
        </Col>
      ))}
    </Row>
  );
};
