/**
 * Executive Dashboard distribution charts (category + priority)
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { Col, Row, Tag } from 'antd';
import CardPanel from '@/components/CardPanel';
import { BarChart, PieChart, type BarDataItem, type PieDataItem } from '@/components/charts';
import { CATEGORY_NAMES, PRIORITY_NAMES } from '../constants';

interface DistributionChartsProps {
  byCategory: Record<string, { count: number; resolved?: number }>;
  byPriority: Record<string, { count: number; resolved: number }>;
}

export const DistributionCharts = ({ byCategory, byPriority }: DistributionChartsProps) => (
  <Row gutter={[16, 16]}>
    <Col xs={24} xl={14}>
      <CardPanel
        title="工单分类分布"
        extra={<Tag color="purple">{Object.keys(byCategory).length}个分类</Tag>}
      >
        <PieChart
          title="工单分类分布"
          data={Object.entries(byCategory).map(
            ([key, val]): PieDataItem => ({
              name: CATEGORY_NAMES[key] || key,
              value: val.count,
            }),
          )}
          variant="donut"
          centerLabel={true}
          height={240}
        />
      </CardPanel>
    </Col>

    <Col xs={24} xl={10}>
      <CardPanel title="优先级分布">
        <BarChart
          data={Object.entries(byPriority).flatMap(
            ([key, val]): BarDataItem[] => [
              { label: PRIORITY_NAMES[key] || key, value: val.count, series: '总数' },
              { label: PRIORITY_NAMES[key] || key, value: val.resolved, series: '已解决' },
            ],
          )}
          stacked={false}
          height={240}
        />
      </CardPanel>
    </Col>
  </Row>
);
