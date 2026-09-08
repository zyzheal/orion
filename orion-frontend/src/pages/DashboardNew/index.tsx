/**
 * 全新 Dashboard - 工作看板
 * 展示待处理事项、系统状态、快速入口
 * 对接真实后端API获取数据
 * 8 文件拆分: types.ts + constants.tsx + useDashboardState.ts + DashboardColumns.tsx + RightPanel.tsx + index.tsx
 * 抽取自 705 行原始文件 (P2-9 Phase 67)
 * P2-9 Phase 285: 180->100 行 (-44%), 新增 Components/{PageHeader,StatsCards,MainColumn}.tsx
 */
import React from 'react';
import { Row, Col, Alert, Spin, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { spacing } from '@/tokens';
import { useDashboardState } from './useDashboardState';
import { useTaskColumns, usePipelineColumns } from './DashboardColumns';
import {
  DashboardLinksCard,
  SystemHealthCard,
  QuickActionsCard,
  AlertsCard,
} from './RightPanel';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { MainColumn } from './Components/MainColumn';

const DashboardNew: React.FC = () => {
  const navigate = useNavigate();

  const {
    loading,
    error,
    pipelineStats,
    tasks,
    taskStats,
    recentPipelineRecords,
    systemHealth,
    loadData,
    handleRetry,
  } = useDashboardState();

  const taskColumns = useTaskColumns();
  const pipelineColumns = usePipelineColumns({ navigate, handleRetry });

  if (loading) {
    return (
      <div
        style={{
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          gap: spacing[3],
        }}
      >
        <Spin size="large" />
        <Typography.Text type="secondary">加载数据中...</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {error && (
        <Alert
          message="提示"
          description={error}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: spacing.md }}
        />
      )}

      <PageHeader loading={loading} onRefresh={loadData} />

      <StatsCards pipelineStats={pipelineStats} taskStats={taskStats} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <MainColumn
            tasks={tasks}
            taskColumns={taskColumns}
            recentPipelineRecords={recentPipelineRecords}
            pipelineColumns={pipelineColumns}
          />
        </Col>

        <Col xs={24} xl={8}>
          <DashboardLinksCard navigate={navigate} />
          <SystemHealthCard health={systemHealth} />
          <QuickActionsCard navigate={navigate} />
          <AlertsCard failed={pipelineStats.failed} running={pipelineStats.running} />
        </Col>
      </Row>
    </div>
  );
};

export default DashboardNew;
