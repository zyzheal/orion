/**
 * ProgressiveDeployTab - 渐进式部署
 * 抽取自 DeployPage.tsx (P2-9 Phase 113)
 */
import React from 'react';
import { Card, Button, Table as AntTable } from 'antd';
import { RiseOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProgressiveDeployment } from '../config';
import { useProgressiveColumns } from '../columns';
import type { DeployState } from '../useDeployState';

interface ProgressiveDeployTabProps {
  state: DeployState;
}

export const ProgressiveDeployTab: React.FC<ProgressiveDeployTabProps> = ({ state }) => {
  const {
    progressiveDeploys,
    progressiveDeployForm,
    setProgressiveDeployModalVisible,
    openProgressiveDetail,
    handleAdvanceStage,
    handleRollbackProgressive,
  } = state;

  const progressiveColumns = useProgressiveColumns({
    openProgressiveDetail,
    handleAdvanceStage,
    handleRollbackProgressive,
  });

  return (
    <Card
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            progressiveDeployForm.resetFields();
            setProgressiveDeployModalVisible(true);
          }}
        >
          创建渐进式部署
        </Button>
      }
    >
      <AntTable<ProgressiveDeployment>
        columns={progressiveColumns}
        dataSource={progressiveDeploys}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />
    </Card>
  );
};

export const ProgressiveDeployTabLabel = (
  <>
    <RiseOutlined style={{ marginRight: 6 }} />
    渐进式部署
  </>
);
