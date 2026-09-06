/**
 * DetailDrawer - 任务详情抽屉
 * 抽取自 index.tsx (P2-9 Phase 105)
 */
import React from 'react';
import { Drawer, Descriptions, Tag, Text, Space, Button, Popconfirm } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import { statusColorMap, statusLabelMap, statusIconMap, formatPayload } from '../constants';
import type { QueueState } from '../useQueueState';

interface DetailDrawerProps {
  state: QueueState;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({ state }) => {
  const { selectedJob } = state;
  return (
    <Drawer
      title="任务详情"
      open={state.detailDrawerVisible}
      onClose={() => state.setDetailDrawerVisible(false)}
      width={700}
      destroyOnClose
    >
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

          {/* Action buttons for processing jobs */}
          {selectedJob.status === 'processing' && (
            <div style={{ marginTop: spacing.md }}>
              <Space>
                <Popconfirm
                  title="确认标记为完成?"
                  onConfirm={() => {
                    state.handleComplete(selectedJob.id);
                    state.setDetailDrawerVisible(false);
                  }}
                >
                  <Button type="primary" icon={<CheckCircleOutlined />}>
                    标记完成
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="确认标记为失败?"
                  onConfirm={() => {
                    state.handleFail(selectedJob.id);
                    state.setDetailDrawerVisible(false);
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
};
