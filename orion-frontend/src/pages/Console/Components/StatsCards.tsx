/**
 * Console StatsCards
 * 抽取自 index.tsx (P2-9 Phase 196)
 */
import { Card, Col, Progress, Row, Statistic, Tag } from 'antd';
import {
  AppstoreOutlined,
  SettingOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ConsoleStats } from '../useConsoleState';

interface StatsCardsProps {
  stats: ConsoleStats;
}

export const StatsCards = ({ stats }: StatsCardsProps) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} sm={12} lg={6}>
      <Card hoverable onClick={() => (window.location.href = '/console/plugins')}>
        <Statistic
          title="已安装插件"
          value={stats.totalPlugins}
          prefix={<AppstoreOutlined />}
          valueStyle={{ color: colors.primary[500] }}
        />
        <Progress
          percent={stats.totalPlugins > 0 ? (stats.activePlugins / stats.totalPlugins) * 100 : 0}
          strokeColor={colors.primary[500]}
          size="small"
          style={{ marginTop: spacing[3] }}
          format={() => `${stats.activePlugins} 个运行中`}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card hoverable onClick={() => (window.location.href = '/console/settings')}>
        <Statistic
          title="功能开关"
          value={stats.totalFlags}
          prefix={<SettingOutlined />}
          valueStyle={{ color: colors.purple[500] }}
        />
        <Progress
          percent={stats.totalFlags > 0 ? (stats.enabledFlags / stats.totalFlags) * 100 : 0}
          strokeColor={colors.purple[500]}
          size="small"
          style={{ marginTop: spacing[3] }}
          format={() => `${stats.enabledFlags} 个已启用`}
        />
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card hoverable onClick={() => (window.location.href = '/console/users')}>
        <Statistic
          title="系统用户"
          value="-"
          prefix={<UserOutlined />}
          valueStyle={{ color: colors.primary[500] }}
        />
        <div style={{ marginTop: spacing.md }}>
          <Tag color="blue">管理用户 →</Tag>
        </div>
      </Card>
    </Col>
    <Col xs={24} sm={12} lg={6}>
      <Card>
        <Statistic
          title="系统健康度"
          value="-"
          prefix={<SafetyCertificateOutlined />}
          valueStyle={{ color: colors.neutral[500] }}
        />
        <div style={{ marginTop: spacing.md }}>
          <Tag>健康检查开发中</Tag>
        </div>
      </Card>
    </Col>
  </Row>
);
