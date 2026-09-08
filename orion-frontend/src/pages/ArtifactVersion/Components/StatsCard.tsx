/**
 * StatsCard - Artifact 版本统计
 * 抽取自 index.tsx (P2-9 Phase 210)
 */
import { Card, Row, Col, Statistic } from 'antd';
import type { ArtifactVersion } from '@/api/artifactVersions';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';

interface Props {
  versions: ArtifactVersion[];
  total: number;
}

export const StatsCard = ({ versions, total }: Props) => (
  <Card style={{ marginBottom: spacing.lg }}>
    <Row gutter={16}>
      <Col span={6}>
        <Statistic title="总版本数" value={total} />
      </Col>
      <Col span={6}>
        <Statistic
          title="今日新增"
          value={versions.filter((v) => dayjs(v.createdAt).isAfter(dayjs().startOf('day'))).length}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="关联分支"
          value={new Set(versions.map((v) => v.branch).filter(Boolean)).size}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="关联 Pipeline"
          value={new Set(versions.map((v) => v.pipelineId)).size}
        />
      </Col>
    </Row>
  </Card>
);
