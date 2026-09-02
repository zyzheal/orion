/**
 * CAB Meeting Detail Content — Descriptions + Decisions Timeline
 *
 * Extracted from index.tsx to reduce main file size.
 */
import { Descriptions, Tag, Typography, Space, Card, Timeline, Empty } from 'antd';
const { Text } = Typography;
import { spacing } from '@/tokens';
import type { CABMeeting } from '@/api/change';
import { cabStatusConfig } from './config';
import dayjs from 'dayjs';

interface CABDetailContentProps {
  cab: CABMeeting;
}

export function CABDetailContent({ cab }: CABDetailContentProps) {
  return (
    <>
      <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
        <Descriptions.Item label="会议 ID">{cab.id}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={cabStatusConfig[cab.status]?.color}>
            {cabStatusConfig[cab.status]?.label || cab.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="会议时间" span={2}>
          {dayjs(cab.scheduled_at).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="地点">{cab.location || '-'}</Descriptions.Item>
        <Descriptions.Item label="创建人">
          {cab.created_by || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {cab.description || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="参会人" span={2}>
          {cab.attendees?.length ? (
            <Space size={4} wrap>
              {cab.attendees.map((a) => (
                <Tag key={a}>{a}</Tag>
              ))}
            </Space>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {dayjs(cab.created_at).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {dayjs(cab.updated_at).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
      </Descriptions>

      <Card title="决策记录" size="small" type="inner">
        {cab.decisions?.length ? (
          <Timeline
            items={cab.decisions.map((d) => ({
              color:
                d.decision === 'approved'
                  ? 'green'
                  : d.decision === 'rejected'
                    ? 'red'
                    : 'orange',
              children: (
                <div>
                  <Space>
                    <Tag
                      color={
                        d.decision === 'approved'
                          ? 'green'
                          : d.decision === 'rejected'
                            ? 'red'
                            : 'orange'
                      }
                    >
                      {d.decision === 'approved'
                        ? '批准'
                        : d.decision === 'rejected'
                          ? '拒绝'
                          : '推迟'}
                    </Tag>
                    <Text type="secondary">变更请求: {d.changeRequestId}</Text>
                  </Space>
                  {d.notes && <div style={{ marginTop: spacing.xs }}>{d.notes}</div>}
                </div>
              ),
            }))}
          />
        ) : (
          <Empty description="暂无决策记录" />
        )}
      </Card>
    </>
  );
}
