/**
 * StatsRow - 4 张上传统计卡
 * 抽取自 index.tsx (P2-9 Phase 215)
 */
import { Card, Statistic, Row, Col } from 'antd';
import { colors, spacing } from '@/tokens';

interface Stats {
  total: number;
  published: number;
  failed: number;
  uploading: number;
}

interface Props {
  stats: Stats;
}

export const StatsRow = ({ stats }: Props) => (
  <Row gutter={16} style={{ marginBottom: spacing.lg }}>
    <Col span={6}>
      <Card>
        <Statistic title="总上传次数" value={stats.total} />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="成功发布"
          value={stats.published}
          valueStyle={{ color: colors.success[600] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="上传失败"
          value={stats.failed}
          valueStyle={{ color: colors.error[600] }}
        />
      </Card>
    </Col>
    <Col span={6}>
      <Card>
        <Statistic
          title="上传中"
          value={stats.uploading}
          valueStyle={{ color: colors.primary[500] }}
        />
      </Card>
    </Col>
  </Row>
);
