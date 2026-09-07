/**
 * ContainerScan Stats Row
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { spacing } from '@/tokens';
import { commonStyle } from '../constants';

const { Text } = Typography;

const CARD_STYLE = {
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

interface StatsRowProps {
  totalImages: number;
  highVulns: number;
  fixRate: number;
  pendingScan: number;
}

export const StatsRow: React.FC<StatsRowProps> = ({
  totalImages,
  highVulns,
  fixRate,
  pendingScan,
}) => (
  <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card style={{ ...CARD_STYLE, borderLeft: `3px solid ${commonStyle.primary}` }}>
        <Statistic
          title="扫描镜像总数"
          value={totalImages}
          valueStyle={{ color: commonStyle.primary }}
          suffix={
            <Text type="secondary" style={{ fontSize: 14 }}>
              个镜像
            </Text>
          }
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card style={{ ...CARD_STYLE, borderLeft: `3px solid ${commonStyle.error}` }}>
        <Statistic
          title="高危漏洞数"
          value={highVulns}
          valueStyle={{ color: commonStyle.error }}
          suffix={
            <Text type="secondary" style={{ fontSize: 14 }}>
              个漏洞
            </Text>
          }
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card style={{ ...CARD_STYLE, borderLeft: `3px solid ${commonStyle.success}` }}>
        <Statistic
          title="已修复率"
          value={fixRate}
          valueStyle={{ color: commonStyle.success }}
          suffix={
            <Text type="secondary" style={{ fontSize: 14 }}>
              %
            </Text>
          }
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card style={{ ...CARD_STYLE, borderLeft: `3px solid ${commonStyle.warning}` }}>
        <Statistic
          title="待扫描镜像"
          value={pendingScan}
          valueStyle={{ color: commonStyle.warning }}
          suffix={
            <Text type="secondary" style={{ fontSize: 14 }}>
              个镜像
            </Text>
          }
        />
      </Card>
    </Col>
  </Row>
);
