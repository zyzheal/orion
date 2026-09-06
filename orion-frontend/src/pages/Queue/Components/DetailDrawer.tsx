/**
 * DetailDrawer.tsx - 任务详情抽屉
 * 抽取自 Queue/index.tsx (P2-9 Phase 87)
 */
import React from 'react';
import { Drawer, Descriptions, Button, Space, Popconfirm, Tag } from 'antd';
import { Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { spacing } from '@/tokens';
import { colors } from '@/tokens/colors';
import type { QueueJob } from '@/api/queue';
import { statusColorMap, statusLabelMap, statusIconMap, formatPayload } from '../constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface DetailDrawerProps {
  open: boolean;
  selectedJob: QueueJob | null;
  onClose: () => void;
  handleComplete: (id: string) => Promise<void> | void;
  handleFail: (id: string) => Promise<void> | void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  selectedJob,
  onClose,
  handleComplete,
  handleFail,
}) => (
  <Drawer title="任务详情" open={open} onClose={onClose} width={700} destroyOnClose>
    {selectedJob && (
      <div>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="任务 ID" span={2}>
            <Text code>{selectedJob.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="队列名称">
            <Tag color="blue">{selectedJob.queue}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              color={statusColorMap[selectedJob.status]}
              icon={statusIconMap[selectedJob.status]}
            >
              {statusLabelMap[selectedJob.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="租户 ID">{selectedJob.tenant_id}</Descriptions.Item>
          <Descriptions.Item label="重试次数">{selectedJob.attempts}</Descriptions.Item>
          <Descriptions.Item label="创建时间" span={2}>
            {dayjs(selectedJob.created_at).format('YYYY-MM-DD HH:mm:ss')}
            <Text type="secondary" style={{ marginLeft: spacing.sm }}>
              ({dayjs(selectedJob.created_at).fromNow()})
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Payload" span={2}>
            <pre
              style={{
                background: colors.neutral[100],
                padding: spacing[3],
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'monospace',
                maxHeight: 300,
                overflow: 'auto',
                margin: 0,
              }}
            >
              {formatPayload(selectedJob.payload)}
            </pre>
          </Descriptions.Item>
        </Descriptions>

        {selectedJob.status === 'processing' && (
          <div style={{ marginTop: spacing.md }}>
            <Space>
              <Popconfirm
                title="确认标记为完成?"
                onConfirm={() => {
                  handleComplete(selectedJob.id);
                  onClose();
                }}
              >
                <Button type="primary" icon={<CheckCircleOutlined />}>
                  标记完成
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认标记为失败?"
                onConfirm={() => {
                  handleFail(selectedJob.id);
                  onClose();
                }}
              >
                <Button danger icon={<CloseCircleOutlined />}>
                  标记失败
                </Button>
              </Popconfirm>
            </Space>
          </div>
        )}
      </div>
    )}
  </Drawer>
);
