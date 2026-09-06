/**
 * DurationDistribution - 耗时分布柱状列表
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Card, List, Row, Col, Progress, Tag, Typography, Empty } from 'antd';
import { colors } from '@/tokens';
import type { DurationBucket } from './types';

const { Text } = Typography;

export interface DurationDistributionProps {
  buckets: DurationBucket[];
  successCount: number;
}

export const DurationDistribution: React.FC<DurationDistributionProps> = ({
  buckets,
  successCount,
}) => (
  <Card title="耗时分布" style={{ height: 220 }}>
    {buckets.length > 0 ? (
      <List
        size="small"
        dataSource={buckets}
        renderItem={(bucket) => (
          <List.Item>
            <Row style={{ width: '100%' }} align="middle">
              <Col span={8}>
                <Text strong>{bucket.label}</Text>
              </Col>
              <Col span={12}>
                <Progress
                  percent={
                    successCount > 0 ? Math.round((bucket.count / successCount) * 100) : 0
                  }
                  size="small"
                  showInfo={false}
                  strokeColor={bucket.count > 0 ? colors.primary[500] : colors.neutral[200]}
                />
              </Col>
              <Col span={4}>
                <Tag>{bucket.count}</Tag>
              </Col>
            </Row>
          </List.Item>
        )}
      />
    ) : (
      <Empty description="无数据" />
    )}
  </Card>
);
