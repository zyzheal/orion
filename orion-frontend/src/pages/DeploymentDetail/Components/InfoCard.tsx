/**
 * DeploymentDetail info card
 * 抽取自 index.tsx (P2-9 Phase 168)
 */
import { Button, Descriptions, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import CardPanel from '@/components/CardPanel';
import dayjs from 'dayjs';
import type { Deployment } from '@/api/deployments';
import { envConfig, formatDuration, strategyLabels } from '../constants';

const { Text } = Typography;

interface InfoCardProps {
  deployment: Deployment;
}

export const InfoCard = ({ deployment }: InfoCardProps) => {
  const navigate = useNavigate();
  const env = envConfig[deployment.environment] || {
    color: 'default',
    label: deployment.environment,
  };

  return (
    <CardPanel>
      <Descriptions column={4} size="small" bordered labelStyle={{ width: 120 }}>
        <Descriptions.Item label="应用名称">
          <Text strong>{deployment.appName}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="部署版本">
          <Tag color="purple">{deployment.version}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="目标环境">
          <Tag color={env.color}>{env.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="部署策略">
          {strategyLabels[deployment.strategy] || deployment.strategy}
        </Descriptions.Item>
        <Descriptions.Item label="触发人">
          <Text code>{deployment.triggeredBy}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="开始时间">
          {deployment.startTime ? dayjs(deployment.startTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="结束时间">
          {deployment.endTime
            ? dayjs(deployment.endTime).format('YYYY-MM-DD HH:mm:ss')
            : '进行中...'}
        </Descriptions.Item>
        <Descriptions.Item label="耗时">{formatDuration(deployment.duration)}</Descriptions.Item>
        {deployment.commit && (
          <Descriptions.Item label="提交 Hash">
            <Tag color="default">{deployment.commit}</Tag>
          </Descriptions.Item>
        )}
        {deployment.pipelineRunId && (
          <Descriptions.Item label="关联 Pipeline">
            <Button
              type="link"
              size="small"
              onClick={() => navigate(`/pipelines/${deployment.pipelineRunId}`)}
            >
              {deployment.pipelineRunId}
            </Button>
          </Descriptions.Item>
        )}
        {deployment.rollbackFrom && (
          <Descriptions.Item label="回滚来源">
            <Button
              type="link"
              size="small"
              onClick={() => navigate(`/deployments/${deployment.rollbackFrom}`)}
            >
              {deployment.rollbackFrom}
            </Button>
          </Descriptions.Item>
        )}
      </Descriptions>
    </CardPanel>
  );
};
