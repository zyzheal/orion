import { Card, Row, Col, Statistic } from 'antd';
import { ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, CodeOutlined, FileProtectOutlined, SyncOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface Props {
  stats: { total: number; verified: number; drift: number; missing: number; rate: number };
}

export function StatsRow({ stats }: Props) {
  return (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
      <Col span={4}><Card size="small"><Statistic title="契约总数" value={stats.total} prefix={<ApiOutlined />} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="已通过" value={stats.verified} prefix={<CheckCircleOutlined />} valueStyle={{ color: colors.success[500] }} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="漂移" value={stats.drift} prefix={<CloseCircleOutlined />} valueStyle={{ color: colors.error[500] }} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="缺失" value={stats.missing} prefix={<CodeOutlined />} valueStyle={{ color: colors.warning[500] }} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="通过率" value={stats.rate} suffix="%" prefix={<FileProtectOutlined />} valueStyle={{ color: stats.rate >= 80 ? colors.success[500] : colors.warning[500] }} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="Mock Server" value="运行中" prefix={<SyncOutlined spin />} valueStyle={{ color: colors.success[500] }} /></Card></Col>
    </Row>
  );
}
