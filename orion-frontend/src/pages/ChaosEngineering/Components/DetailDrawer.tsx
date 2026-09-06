/**
 * DetailDrawer.tsx - 混沌实验详情抽屉
 * 抽取自 ChaosEngineering/index.tsx (P2-9 Phase 91)
 */
import React from 'react';
import { Drawer, Descriptions, Tag, Space, Card, Button, Text } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { ChaosExperiment } from '@/api/chaos';
import { spacing } from '@/tokens';
import { faultTypeConfig, statusConfig, envConfig } from '../constants';

interface DetailDrawerProps {
  open: boolean;
  experiment: ChaosExperiment | null;
  runningId: string | null;
  onClose: () => void;
  onRun: (id: string) => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  experiment,
  runningId,
  onClose,
  onRun,
}) => (
  <Drawer
    title={experiment?.name || '实验详情'}
    open={open}
    onClose={onClose}
    width={720}
    destroyOnClose
  >
    {experiment && (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="实验名称" span={2}>
            {experiment.name}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {(() => {
              const cfg = statusConfig[experiment.status] || statusConfig.draft;
              return <Tag color={cfg.color}>{cfg.label}</Tag>;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="环境">
            {(() => {
              const env = experiment.scope?.environment || 'staging';
              const cfg = envConfig[env] || envConfig.staging;
              return <Tag color={cfg.color}>{cfg.label}</Tag>;
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="目标服务">
            {experiment.scope?.service_id || '全部服务'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {experiment.description || '-'}
          </Descriptions.Item>
        </Descriptions>

        {/* Faults */}
        <Card size="small" title="故障配置">
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {(experiment.faults || []).map((f, i) => {
              const cfg = faultTypeConfig[f.type] || { label: f.type, color: 'default' };
              return (
                <div key={String(i)}>
                  <Tag color={cfg.color}>{cfg.label}</Tag>
                  <Text type="secondary" style={{ marginLeft: spacing.sm }}>
                    持续 {f.duration || 60}s | 严重程度 {f.severity || 'medium'}
                  </Text>
                </div>
              );
            })}
          </Space>
        </Card>

        {/* Actions */}
        {experiment.status === 'active' && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={runningId === experiment.id}
            onClick={() => onRun(experiment.id)}
          >
            运行实验
          </Button>
        )}
      </Space>
    )}
  </Drawer>
);
