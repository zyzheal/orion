/**
 * Deploy Page
 * Deployment list, deployment windows, progressive deployment, emergency deploy
 *
 * 2026-08-26: 拆分 3 Tab + Header + StatsRow + state hook 至 Components/ 与 useDeployState.tsx (P2-9 Phase 113)
 */
import React from 'react';
import { Tabs } from 'antd';
import { useDeployState } from './useDeployState';
import { DeployHeader } from './Components/DeployHeader';
import { DeployStatsRow } from './Components/DeployStatsRow';
import {
  DeploymentsTab,
  DeploymentsTabLabel,
} from './Components/DeploymentsTab';
import {
  DeployWindowsTab,
  DeployWindowsTabLabel,
} from './Components/DeployWindowsTab';
import {
  ProgressiveDeployTab,
  ProgressiveDeployTabLabel,
} from './Components/ProgressiveDeployTab';
import { DeployModals } from './DeployModals';

const { TabPane } = Tabs;

const DeployPage: React.FC = () => {
  const state = useDeployState();
  const {
    loading,
    loadData,
    stats,
    emergencyForm,
    setEmergencyModalVisible,
    setCreateModalVisible,
  } = state;

  return (
    <div style={{ padding: 0 }}>
      <DeployHeader
        loading={loading}
        onLoadData={loadData}
        onEmergencyDeploy={() => {
          emergencyForm.resetFields();
          setEmergencyModalVisible(true);
        }}
        onCreate={() => setCreateModalVisible(true)}
      />

      <DeployStatsRow stats={stats} />

      <Tabs defaultActiveKey="deployments" size="large">
        <TabPane tab={DeploymentsTabLabel} key="deployments">
          <DeploymentsTab state={state} />
        </TabPane>
        <TabPane tab={DeployWindowsTabLabel} key="windows">
          <DeployWindowsTab state={state} />
        </TabPane>
        <TabPane tab={ProgressiveDeployTabLabel} key="progressive">
          <ProgressiveDeployTab state={state} />
        </TabPane>
      </Tabs>

      <DeployModals {...state} />
    </div>
  );
};

export default DeployPage;
