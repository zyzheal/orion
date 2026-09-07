/**
 * Deployment Detail Page (TASK-905) - FIXED P0-2
 * Deployment detail with info, stage progress, health checks, and rollback.
 * Uses real API calls instead of mock data.
 * 组件化重构 (P2-9 Phase 168): 417→78 行
 */
import React from 'react';
import { Button, Col, Result, Row, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDeploymentDetailState } from './useDeploymentDetailState';
import { PageHeader } from './Components/PageHeader';
import { RollbackModal } from './Components/RollbackModal';
import { InfoCard } from './Components/InfoCard';
import { StagesPanel } from './Components/StagesPanel';
import { HealthCheckPanel } from './Components/HealthCheckPanel';

const DeploymentDetail: React.FC = () => {
  const navigate = useNavigate();
  const {
    deployment,
    loading,
    isRollingBack,
    rollbackModalVisible,
    setRollbackModalVisible,
    handleRollback,
  } = useDeploymentDetailState();

  if (loading && !deployment) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!deployment) {
    return (
      <Result
        status="404"
        title="部署不存在"
        subTitle="未找到该部署记录"
        extra={
          <Button type="primary" onClick={() => navigate('/deployments')}>
            返回列表
          </Button>
        }
      />
    );
  }

  const canRollback = deployment.status === 'success';

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        deployment={deployment}
        canRollback={canRollback}
        isRollingBack={isRollingBack}
        onOpenRollback={() => setRollbackModalVisible(true)}
      />

      <RollbackModal
        deployment={deployment}
        open={rollbackModalVisible}
        isRollingBack={isRollingBack}
        onOk={handleRollback}
        onCancel={() => setRollbackModalVisible(false)}
      />

      <InfoCard deployment={deployment} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <StagesPanel stages={deployment.stages} />
        </Col>
        <Col xs={24} xl={10}>
          <HealthCheckPanel healthChecks={deployment.healthChecks ?? []} />
        </Col>
      </Row>
    </div>
  );
};

export default DeploymentDetail;
