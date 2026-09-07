/**
 * ModuleManagerHeader - 页面头部
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import React from 'react';
import { Button, Space, Typography } from 'antd';
import {
  ClusterOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { ModuleManagerState } from '../useModuleManagerState';

const { Title, Text } = Typography;

interface ModuleManagerHeaderProps {
  state: ModuleManagerState;
}

export const ModuleManagerHeader: React.FC<ModuleManagerHeaderProps> = ({ state }) => {
  const { stats, loadAll, loadValidation, loading, setActiveTab } = state;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[6],
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <ClusterOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
          模块管理
        </Title>
        <Text type="secondary">
          共 {stats.total} 个模块 · {stats.active} 个活跃 ·{' '}
          {stats.failed > 0 && `${stats.failed} 个失败`}
        </Text>
      </div>
      <Space>
        <Button
          icon={<ThunderboltOutlined />}
          onClick={() => {
            setActiveTab('validation');
            loadValidation();
          }}
        >
          依赖校验
        </Button>
        <Button
          icon={<PlayCircleOutlined />}
          onClick={() => {
            setActiveTab('validation');
            loadValidation();
          }}
        >
          启动顺序
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>
          刷新
        </Button>
      </Space>
    </div>
  );
};
