/**
 * Components/StrategyInfo.tsx - 灾备策略卡片
 * 抽取自 DisasterRecovery/index.tsx (P2-9 Phase 100)
 */
import React from 'react';
import { Card, Space, Tag, Descriptions, Typography } from 'antd';
import { ThunderboltOutlined, HddOutlined } from '@ant-design/icons';

const { Text } = Typography;

export const StrategyInfo: React.FC = () => (
  <Card
    title={
      <Space>
        <ThunderboltOutlined />
        <Text strong>灾备策略</Text>
      </Space>
    }
    style={{ borderRadius: 12 }}
  >
    <Descriptions bordered column={3} size="middle" style={{ borderRadius: 6 }}>
      <Descriptions.Item label="灾备级别">
        <Space>
          <Tag color="blue">多活</Tag>
          <Tag color="orange">主备</Tag>
          <Tag color="default">备份恢复</Tag>
        </Space>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          核心服务多活，辅助服务主备
        </Text>
      </Descriptions.Item>
      <Descriptions.Item label="备份频率">
        <Space>
          <Tag color="green">实时同步</Tag>
          <Tag color="blue">每小时</Tag>
          <Tag>每日</Tag>
        </Space>
        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
          根据 RPO 级别动态调整
        </Text>
      </Descriptions.Item>
      <Descriptions.Item label="存储位置">
        <Space>
          <HddOutlined />
          <Text>主数据中心 (DC-A)</Text>
        </Space>
        <Space style={{ marginTop: 4 }}>
          <HddOutlined />
          <Text>灾备中心 (DC-B)</Text>
        </Space>
        <Space style={{ marginTop: 4 }}>
          <HddOutlined />
          <Text>云端备份 (AWS S3)</Text>
        </Space>
      </Descriptions.Item>
      <Descriptions.Item label="RTO 策略">
        <Text>核心服务 &lt; 5min，辅助服务 &lt; 30min</Text>
      </Descriptions.Item>
      <Descriptions.Item label="RPO 策略">
        <Text>核心服务 &lt; 1min，辅助服务 &lt; 60min</Text>
      </Descriptions.Item>
      <Descriptions.Item label="切换方式">
        <Text>自动 failover + 手动确认</Text>
      </Descriptions.Item>
    </Descriptions>
  </Card>
);
