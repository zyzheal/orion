/**
 * ChaosEngineering Detail Drawer
 * 抽取自 index.tsx (P2-9 Phase 132)
 */
import React from 'react';
import { Drawer, Space, Descriptions, Tag, Card, Button, Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ChaosExperiment } from '@/api/chaos';
import { faultTypeConfig, statusConfig, envConfig } from '../constants';

const { Text } = Typography;

interface DetailDrawerProps {
  open: boolean;
  selectedExperiment: ChaosExperiment | null;
  runningId: string | null;
  onClose: () => void;
  handleRunExperiment: (experimentId: string) => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  selectedExperiment,
  runningId,
  onClose,
  handleRunExperiment,
}) => (
  <Drawer
    title={selectedExperiment?.name || '实验详情'}
    open={open}
    onClose={onClose}
    width={720}
    destroyOnClose
  >
    {selectedExperiment && (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="实验名称" span={2}>
            {selectedExperiment.name}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {(() => {
              const cfg = statusConfig[selectedExperiment.status] || statusConfig.draft;
              return <Tag color={cfg.color}>{cfg.label}</Tag>;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="环境">
            {(() => {
              const env = selectedExperiment.scope?.environment || 'staging';
              const cfg = envConfig[env] || envConfig.staging;
              return <Tag color={cfg.color}>{cfg.label}</Tag>;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="目标服务">
            {selectedExperiment.scope?.service_id || '全部服务'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {selectedExperiment.description || '-'}
          </Descriptions.Item>
        </Descriptions>

        <Card size="small" title="故障配置">
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {(selectedExperiment.faults || []).map(
              (f: { type: string; duration?: number; severity?: string }, i: number) => {
                const cfg = faultTypeConfig[f.type] || { label: f.type, color: 'default' };
                return (
                  <div key={String(i)} >
                    <Tag color={cfg.color}>{cfg.label}</Tag>
                    <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                      持续 {f.duration || 60}s | 严重程度 {f.severity || 'medium'}
                    </Text>
                  </div>
                );
              }
            )}
          </Space>
        </Card>

        {selectedExperiment.status === 'active' && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={runningId === selectedExperiment.id}
            onClick={() => handleRunExperiment(selectedExperiment.id)}
          >
            运行实验
          </Button>
        )}
      </Space>
    )}
  </Drawer>
);
