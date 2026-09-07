/**
 * DeployHeader - 部署页顶部标题与操作按钮
 * 抽取自 DeployPage.tsx (P2-9 Phase 113)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface DeployHeaderProps {
  loading: boolean;
  onLoadData: () => void;
  onEmergencyDeploy: () => void;
  onCreate: () => void;
}

export const DeployHeader: React.FC<DeployHeaderProps> = ({
  loading,
  onLoadData,
  onEmergencyDeploy,
  onCreate,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <CloudUploadOutlined
          style={{ marginRight: spacing[3], color: colors.primary[500] }}
        />
        部署发布
      </Title>
      <Text type="secondary">管理部署任务、部署窗口、渐进式部署和紧急部署</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onLoadData} loading={loading}>
        刷新
      </Button>
      <Button icon={<ThunderboltOutlined />} danger onClick={onEmergencyDeploy}>
        紧急部署
      </Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        创建部署
      </Button>
    </Space>
  </div>
);
