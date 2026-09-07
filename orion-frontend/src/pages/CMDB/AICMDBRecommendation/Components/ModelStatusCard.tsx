/**
 * AICMDBRecommendation model status card
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import React from 'react';
import { Card, Typography, Descriptions, Statistic, Tag, Button } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ModelStatus } from '../types';
import { AccuracyTrendSVG } from './AccuracyTrendSVG';

const { Text } = Typography;

interface ModelStatusCardProps {
  modelStatus: ModelStatus;
  retraining: boolean;
  handleRetrain: () => void;
}

export const ModelStatusCard: React.FC<ModelStatusCardProps> = ({
  modelStatus,
  retraining,
  handleRetrain,
}) => (
  <Card title="AI 模型状态" style={{ height: '100%' }}>
    <Descriptions column={1} size="small" style={{ marginBottom: spacing.md }}>
      <Descriptions.Item label="模型版本">
        <Tag color={colors.purple[500]}>v{modelStatus.version}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="训练数据量">
        <Statistic
          value={modelStatus.trainingDataCount}
          precision={0}
          formatter={() => modelStatus.trainingDataCount.toLocaleString()}
          suffix=" 条"
          valueStyle={{ fontSize: 18 }}
        />
      </Descriptions.Item>
      <Descriptions.Item label="最后训练时间">
        <Text type="secondary">{modelStatus.lastTrainedAt}</Text>
      </Descriptions.Item>
    </Descriptions>
    <div style={{ marginBottom: spacing.md }}>
      <Text strong style={{ marginBottom: 4, display: 'block' }}>
        准确率趋势（近 7 天）
      </Text>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AccuracyTrendSVG data={modelStatus.accuracyTrend} />
      </div>
    </div>
    <Button
      type="primary"
      icon={<RocketOutlined />}
      onClick={handleRetrain}
      loading={retraining}
      style={retraining
        ? { width: '100%', backgroundColor: colors.purple[500], borderColor: colors.purple[500] }
        : { width: '100%' }}
      disabled={retraining}
    >
      重新训练模型
    </Button>
  </Card>
);
