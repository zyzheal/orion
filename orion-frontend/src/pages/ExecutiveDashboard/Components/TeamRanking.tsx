/**
 * Executive Dashboard team ranking (top + bottom performers)
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { Col, Row, Table, Tag, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';
import CardPanel from '@/components/CardPanel';
import { BarChart, type BarDataItem } from '@/components/charts';

const { Text } = Typography;

export interface TopPerformer {
  engineerId: string;
  name: string;
  resolved: number;
  score: number;
}

export interface BottomPerformer {
  engineerId: string;
  name: string;
  score: number;
  needsAttention: string;
}

interface TeamRankingProps {
  topPerformers: TopPerformer[];
  bottomPerformers: BottomPerformer[];
  topColumns: ColumnsType<TopPerformer>;
}

export const TeamRanking = ({ topPerformers, bottomPerformers, topColumns }: TeamRankingProps) => (
  <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
    <Col xs={24} xl={14}>
      <CardPanel title="团队排名 - 优秀工程师" extra={<Tag color="gold">Top 5</Tag>}>
        <Table
          dataSource={topPerformers}
          columns={topColumns}
          rowKey="engineerId"
          pagination={false}
          size="middle"
        />
      </CardPanel>
    </Col>

    <Col xs={24} xl={10}>
      <CardPanel title="需关注工程师" extra={<Tag color="orange">Attention</Tag>}>
        <BarChart
          data={bottomPerformers.map(
            (m): BarDataItem => ({ label: m.name, value: m.score }),
          )}
          height={200}
        />
        <div style={{ marginTop: spacing.sm, padding: `0 ${spacing[2]}` }} >
          {bottomPerformers.map((member) => (
            <div key={member.engineerId} style={{ marginBottom: spacing[2] }}>
              <Text type="warning" style={{ fontSize: spacing[3] }}>
                <WarningOutlined style={{ marginRight: 4 }} />
                {member.needsAttention}
              </Text>
            </div>
          ))}
        </div>
      </CardPanel>
    </Col>
  </Row>
);
