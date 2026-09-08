/**
 * AuthConfig StatsRow
 * 抽取自 index.tsx (P2-9 Phase 203)
 */
import { Card, Col, Row, Statistic } from 'antd';
import {
  BellOutlined,
  KeyOutlined,
  SafetyOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface Props {
  totalProviders: number;
  activeProviders: number;
  totalUsers: number;
  policyCount: number;
}

export const StatsRow = ({ totalProviders, activeProviders, totalUsers, policyCount }: Props) => (
  <Row gutter={ [spacing.md, spacing.md] } style={{ marginBottom: spacing.md }}>
    <Col span={6}>
      <Card size="small">
        <Statistic title="认证源总数" value={totalProviders} prefix={<KeyOutlined />} />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic
          title="活跃认证源"
          value={activeProviders}
          prefix={<SafetyOutlined />}
          valueStyle={{ color: colors.success[500] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic title="绑定用户数" value={totalUsers} prefix={ <UserSwitchOutlined /> } />
      </Card>
    </Col>
    <Col span={6}>
      <Card size="small">
        <Statistic title="策略规则数" value={policyCount} prefix={<BellOutlined />} />
      </Card>
    </Col>
  </Row>
);
