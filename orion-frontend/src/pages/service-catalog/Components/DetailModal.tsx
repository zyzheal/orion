/**
 * ServiceCatalog detail modal with timeline
 */
import React from 'react';
import { Card, Descriptions, Empty, Modal, Space, Tag, Typography } from 'antd';
import type { ServiceCatalog, TimelineEntry } from '@/api/service-catalog';

const { Title, Text } = Typography;

interface DetailModalProps {
  open: boolean;
  item: ServiceCatalog | null;
  timeline: TimelineEntry[];
  onCancel: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ open, item, timeline, onCancel }) => (
  <Modal title="服务目录详情" open={open} onCancel={onCancel} footer={null} width={640} destroyOnClose>
    {item && (
      <>
        <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="名称">{item.name}</Descriptions.Item>
          <Descriptions.Item label="值">{item.value || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {item.enabled ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>
        <Title level={5}>请求时间线</Title>
        {timeline.length === 0 ? (
          <Empty description="暂无时间线记录" />
        ) : (
          timeline.map((entry, i) => (
            <Card key={i} size="small" style={{ marginBottom: 8, borderRadius: 8 }}>
              <Space direction="vertical" size={2}>
                <Text strong>{entry.action}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {entry.by} · {new Date(entry.at).toLocaleString('zh-CN')}
                </Text>
                {entry.comment && <Text>{entry.comment}</Text>}
              </Space>
            </Card>
          ))
        )}
      </>
    )}
  </Modal>
);
