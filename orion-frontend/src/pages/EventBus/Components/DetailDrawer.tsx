/**
 * EventBus Monitoring event detail drawer
 * 抽取自 index.tsx (P2-9 Phase 164)
 */
import { Descriptions, Drawer, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { spacing } from '@/tokens/spacing';
import type { EventBusEvent } from '../types';
import { statusColorMap, statusLabelMap, statusIconMap, formatPayloadSize } from '../constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface DetailDrawerProps {
  open: boolean;
  event: EventBusEvent | null;
  onClose: () => void;
}

export const DetailDrawer = ({ open, event, onClose }: DetailDrawerProps) => (
  <Drawer
    title="事件详情"
    open={open}
    onClose={onClose}
    width={640}
    destroyOnClose
  >
    {event && (
      <Descriptions column={2} bordered size="small">
        <Descriptions.Item label="事件 ID" span={2}>
          <Text code>{event.id}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="事件类型" span={2}>
          <Text strong>{event.eventType}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Topic" span={2}>
          <Text code>{event.topic}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="来源">
          <Tag color="blue">{event.source}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[event.status]} icon={statusIconMap[event.status]}>
            {statusLabelMap[event.status]}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Trace ID">
          <Text code>{event.traceId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="订阅数">{event.subscriberCount}</Descriptions.Item>
        <Descriptions.Item label="Payload 大小">
          <Text code>{formatPayloadSize(event.payloadSize)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="时间" span={2}>
          {dayjs(event.timestamp).format('YYYY-MM-DD HH:mm:ss')}
          <Text type="secondary" style={{ marginLeft: spacing.sm }}>
            ({dayjs(event.timestamp).fromNow()})
          </Text>
        </Descriptions.Item>
      </Descriptions>
    )}
  </Drawer>
);
