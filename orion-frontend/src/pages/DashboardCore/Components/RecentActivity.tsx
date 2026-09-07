/**
 * Dashboard recent activity panel
 * 抽取自 index.tsx (P2-9 Phase 156)
 */
import { Typography } from 'antd';
import { Tag } from 'antd';
import CardPanel from '@/components/CardPanel';
import Timeline, { type TimelineEvent } from '@/components/Timeline';

const { Text } = Typography;

interface RecentActivityProps {
  events: TimelineEvent[];
}

export const RecentActivity = ({ events }: RecentActivityProps) => (
  <CardPanel title="最近活动" extra={<Tag color="blue">实时更新</Tag>}>
    {events.length > 0 ? (
      <Timeline events={events} maxItems={6} showMore mode="left" />
    ) : (
      <Text type="secondary">暂无活动记录</Text>
    )}
  </CardPanel>
);
