/**
 * SubAppManagementHeader - 页面标题
 * 抽取自 index.tsx (P2-9 Phase 127)
 */
import React from 'react';
import { Button, Typography } from 'antd';
import { SettingOutlined, PlusOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import type { SubAppManagementState } from '../useSubAppManagementState';

const { Title, Text } = Typography;

interface SubAppManagementHeaderProps {
  state: SubAppManagementState;
}

export const SubAppManagementHeader: React.FC<SubAppManagementHeaderProps> = ({ state }) => {
  const { handleCreate } = state;

  return (
    <div
      style={{
        marginBottom: spacing.lg,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <SettingOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
          子应用管理
        </Title>
        <Text type="secondary">配置和管理微前端子应用，无需代码修改即可接入新子系统</Text>
      </div>
      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
        新增子应用
      </Button>
    </div>
  );
};
