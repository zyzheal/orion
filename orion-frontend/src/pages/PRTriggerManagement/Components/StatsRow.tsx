/**
 * PR Trigger stats row
 */
import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';
import { GithubOutlined, GitlabOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { PRTriggerRule } from '@/api/prTriggers';

interface StatsRowProps {
  rules: PRTriggerRule[];
}

export const StatsRow: React.FC<StatsRowProps> = ({ rules }) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic title="触发规则" value={rules.length} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="活跃规则"
          value={rules.filter((r) => r.enabled).length}
          valueStyle={{ color: colors.success?.[500] || colors.success[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="GitHub PR"
          value={rules.filter((r) => r.provider === 'github' || r.provider === 'both').length}
          prefix={<GithubOutlined />}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="GitLab MR"
          value={rules.filter((r) => r.provider === 'gitlab' || r.provider === 'both').length}
          prefix={<GitlabOutlined />}
        />
      </Card>
    </Col>
  </Row>
);
