/**
 * AICMDBRecommendation anomaly detection card
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import React from 'react';
import { Card, List, Empty, Tag, Space, Typography, Button, Tooltip } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import type { AnomalyDetected } from '@/api/cmdb';
import { severityConfig } from '../constants';

const { Text } = Typography;

interface AnomalyDetectionCardProps {
  anomalies: AnomalyDetected[];
}

export const AnomalyDetectionCard: React.FC<AnomalyDetectionCardProps> = ({ anomalies }) => (
  <Card title="异常检测">
    {anomalies.length === 0 ? (
      <Empty description="暂无异常检测结果" />
    ) : (
      <List
        itemLayout="horizontal"
        dataSource={anomalies.slice(0, 10)}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Tooltip title="异常详情功能开发中">
                <Button type="link" size="small" icon={<EyeOutlined />} disabled>
                  详情
                </Button>
              </Tooltip>,
            ]}
            style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Text strong>{item.ciName}</Text>
                  <Tag color={severityConfig[item.severity]?.color || colors.neutral[500]}>
                    {severityConfig[item.severity]?.label || item.severity}
                  </Tag>
                </Space>
              }
              description={
                <Space>
                  <Text type="secondary">{item.anomalyType}</Text>
                  <Text type="secondary">|</Text>
                  <Text type="secondary">{item.detail}</Text>
                </Space>
              }
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {item.detectedTime}
            </Text>
          </List.Item>
        )}
      />
    )}
  </Card>
);
