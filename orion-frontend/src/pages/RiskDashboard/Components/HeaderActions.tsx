/**
 * HeaderActions - 底部固定操作栏 (刷新/快速检查/全面检查/风险评估)
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Space, Button } from 'antd';
import {
  ReloadOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { RiskDashboardState } from '../useRiskDashboardState';

interface HeaderActionsProps {
  state: RiskDashboardState;
}

export const HeaderActions: React.FC<HeaderActionsProps> = ({ state }) => {
  const { loading, loadData, handleHealthCheck, setAssessModalOpen } = state;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
    >
      <Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
        <Button icon={<SafetyOutlined />} onClick={() => handleHealthCheck('basic')}>
          快速检查
        </Button>
        <Button
          icon={<ExclamationCircleOutlined />}
          onClick={() => handleHealthCheck('comprehensive')}
        >
          全面检查
        </Button>
        <Button
          icon={<WarningOutlined />}
          type="primary"
          onClick={() => setAssessModalOpen(true)}
        >
          风险评估
        </Button>
      </Space>
    </div>
  );
};
