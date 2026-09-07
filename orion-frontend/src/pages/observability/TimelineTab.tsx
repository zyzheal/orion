/**
 * TimelineTab.tsx - 部署时间线 Tab（自包含）
 * 抽取自 observability/RootCausePage.tsx (P2-9 Phase 70)
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Tag,
  Space,
  Button,
  Input,
  Form,
  Timeline,
  Typography,
  message,
} from 'antd';

const { Text } = Typography;
import { SearchOutlined } from '@ant-design/icons';
import { getRcaTimeline, type TimelineEvent } from '@/api/observability';
import { useQuery } from '@/providers/QueryProvider';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

interface TimelineData {
  events: TimelineEvent[];
  totalEvents: number;
  criticalEvents: number;
}

const TimelineTab: React.FC = () => {
  const [deploymentId, setDeploymentId] = useState('');
  const [form] = Form.useForm();

  const {
    data: timeline,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useQuery<TimelineData>({
    queryKey: ['rca-timeline', deploymentId],
    queryFn: async () => {
      const res = await getRcaTimeline(deploymentId);
      const t =
        (
          res.data as any as {
            timeline?: { events?: unknown[]; totalEvents?: number; criticalEvents?: number };
          }
        )?.timeline ?? res.data;
      if (t) {
        return {
          events: (t as any).events || [],
          totalEvents: (t as any).totalEvents || 0,
          criticalEvents: (t as any).criticalEvents || 0,
        };
      }
      return { events: [], totalEvents: 0, criticalEvents: 0 };
    },
    enabled: false, // 点击触发加载（按钮触发的加载保持不自动请求）
    staleTime: 30_000,
  });

  const loadTimeline = async () => {
    if (!deploymentId) {
      message.warning('请输入部署 ID');
      return;
    }
    await refetch();
  };

  const loading = isLoading;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) {
      message.error(`加载时间线失败: ${queryError instanceof Error ? queryError.message : ''}`);
    }
  }, [isError, queryError]);

  const getEventColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return colors.error[400];
      case 'warning':
        return colors.warning[400];
      default:
        return colors.info[400];
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="部署时间线">
        <Form form={form} layout="inline" onFinish={loadTimeline}>
          <Form.Item name="deploymentId" label="部署 ID" rules={[{ required: true }]}>
            <Input
              placeholder="如: deploy-001"
              style={{ width: 240 }}
              value={deploymentId}
              onChange={(e) => setDeploymentId(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SearchOutlined />}>
              加载时间线
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {timeline && (
        <Card
          title={`时间线事件 (${timeline.totalEvents} 个事件, ${timeline.criticalEvents} 个严重)`}
        >
          <Timeline>
            {timeline.events.map((event, i) => (
              <Timeline.Item key={String(i)} color={getEventColor(event.severity)}>
                <Text strong>{event.service}</Text>
                <Tag style={{ marginLeft: spacing.sm }}>{event.eventType}</Tag>
                <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                  {new Date(event.timestamp).toLocaleString()}
                </Text>
                <div style={{ marginTop: 4 }}>{event.description}</div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}
    </Space>
  );
};

export default TimelineTab;
