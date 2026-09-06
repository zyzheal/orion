/**
 * EnvironmentDetailDrawer.tsx - 环境详情抽屉
 * 抽取自 Environments/index.tsx (P2-9 Phase 82)
 */
import React from 'react';
import { Drawer, Tag, Descriptions, Button, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { Environment, EnvironmentStatus } from '@/api/environments';
import { typeColorMap, typeLabelMap, statusColorMap, statusLabelMap } from './constants';

const { Title } = Typography;

interface EnvironmentDetailDrawerProps {
  visible: boolean;
  selectedEnv: Environment | null;
  onClose: () => void;
  handleStatusChange: (id: string, status: EnvironmentStatus) => void;
}

export const EnvironmentDetailDrawer: React.FC<EnvironmentDetailDrawerProps> = ({
  visible,
  selectedEnv,
  onClose,
  handleStatusChange,
}) => (
  <Drawer
    title={selectedEnv ? `${selectedEnv.name}` : '环境详情'}
    open={visible}
    onClose={onClose}
    width={700}
    destroyOnClose
  >
    {selectedEnv && (
      <>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="环境名称">{selectedEnv.name}</Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color={typeColorMap[selectedEnv.type]}>
              {typeLabelMap[selectedEnv.type] || selectedEnv.type}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColorMap[selectedEnv.status]}>
              {statusLabelMap[selectedEnv.status] || selectedEnv.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="项目 ID">{selectedEnv.project_id}</Descriptions.Item>
          <Descriptions.Item label="集群">{selectedEnv.cluster || '-'}</Descriptions.Item>
          <Descriptions.Item label="命名空间">{selectedEnv.namespace || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {selectedEnv.created_at
              ? dayjs(selectedEnv.created_at).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {selectedEnv.updated_at
              ? dayjs(selectedEnv.updated_at).format('YYYY-MM-DD HH:mm:ss')
              : '-'}
          </Descriptions.Item>
        </Descriptions>

        {selectedEnv.config && Object.keys(selectedEnv.config).length > 0 && (
          <div style={{ marginTop: spacing.lg }}>
            <Title level={5}>环境配置</Title>
            <pre
              style={{
                background: colors.neutral[100],
                padding: spacing.md,
                borderRadius: 4,
                fontSize: 13,
                overflow: 'auto',
                maxHeight: 300,
              }}
            >
              {JSON.stringify(selectedEnv.config, null, 2)}
            </pre>
          </div>
        )}

        {/* Quick status actions */}
        <div style={{ marginTop: spacing.lg }}>
          <Title level={5}>快捷操作</Title>
          <Space wrap>
            {selectedEnv.status !== 'active' && (
              <Button
                type="primary"
                onClick={() => {
                  handleStatusChange(selectedEnv.id, 'active');
                  onClose();
                }}
              >
                设为运行中
              </Button>
            )}
            {selectedEnv.status === 'active' && (
              <Button
                danger
                onClick={() => {
                  handleStatusChange(selectedEnv.id, 'maintenance');
                  onClose();
                }}
              >
                设为维护中
              </Button>
            )}
            {selectedEnv.status === 'active' && (
              <Button
                onClick={() => {
                  handleStatusChange(selectedEnv.id, 'inactive');
                  onClose();
                }}
              >
                停用
              </Button>
            )}
          </Space>
        </div>
      </>
    )}
  </Drawer>
);
