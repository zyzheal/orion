/**
 * DeployWindowsTab - 部署窗口
 * 抽取自 DeployPage.tsx (P2-9 Phase 113)
 */
import React from 'react';
import { Card, Button, Alert, Table as AntTable } from 'antd';
import { ClockCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { DeployWindow } from '../config';
import { useWindowColumns } from '../columns';
import type { DeployState } from '../useDeployState';

interface DeployWindowsTabProps {
  state: DeployState;
}

export const DeployWindowsTab: React.FC<DeployWindowsTabProps> = ({ state }) => {
  const { deployWindows, deployWindowForm, setDeployWindowModalVisible, handleDeleteDeployWindow } =
    state;

  const windowColumns = useWindowColumns({ handleDeleteDeployWindow });

  return (
    <Card
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            deployWindowForm.resetFields();
            setDeployWindowModalVisible(true);
          }}
        >
          创建窗口
        </Button>
      }
    >
      <Alert
        message="部署窗口配置"
        description="生产环境仅允许在部署窗口内执行部署（工作日 10:00-16:00）。紧急部署可绕过窗口限制，但需要审批。"
        type="info"
        showIcon
        style={{ marginBottom: spacing.md }}
      />
      <AntTable<DeployWindow>
        columns={windowColumns}
        dataSource={deployWindows}
        rowKey="id"
        size="middle"
        pagination={false}
      />
    </Card>
  );
};

export const DeployWindowsTabLabel = (
  <>
    <ClockCircleOutlined style={{ marginRight: 6 }} />
    部署窗口
  </>
);
