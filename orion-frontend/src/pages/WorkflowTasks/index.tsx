/**
 * Workflow Tasks Page - 工作流人工任务管理页面
 * List, claim, complete, view detail
 *
 * 主入口 (P2-9 Phase 99 refactor: 已抽取 constants / useWorkflowTasksState /
 * columns / Components/DetailDrawer / Components/Modals / Components/StatsPanel)
 */
import React, { useMemo } from 'react';
import {
  Typography,
  Button,
  Card,
  Select,
  Empty,
} from 'antd';
import {
  ReloadOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useWorkflowTasksState } from './useWorkflowTasksState';
import { buildWorkflowTasksColumns } from './columns';
import { STATUS_FILTER_OPTIONS } from './constants';
import { DetailDrawer } from './Components/DetailDrawer';
import { WorkflowTasksModals } from './Components/Modals';
import { StatsPanel } from './Components/StatsPanel';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const WorkflowTasksPage: React.FC = () => {
  const state = useWorkflowTasksState();

  const columns = useMemo(
    () =>
      buildWorkflowTasksColumns({
        currentUserId: state.currentUserId,
        openDetail: state.openDetail,
        openClaimModal: state.openClaimModal,
        openCompleteModal: state.openCompleteModal,
      }),
    [
      state.currentUserId,
      state.openDetail,
      state.openClaimModal,
      state.openCompleteModal,
    ],
  );

  const isInitialLoading = state.loading && state.tasks.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          {/* Header */}
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
                <ProjectOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
                工作流任务
              </Title>
              <Text type="secondary">管理工作流中的人工任务，包括认领和完成</Text>
          </div>
            <Button icon={<ReloadOutlined />} onClick={state.loadData} loading={state.loading}>
              刷新
            </Button>
          </div>

          <StatsPanel stats={state.stats} />

          {/* Filters + Table */}
          <Card>
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
              <Select
                style={{ width: 140 }}
                value={state.statusFilter}
                onChange={state.setStatusFilter}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>

            {state.filteredTasks.length === 0 && !state.loading ? (
              <Empty description="暂无任务">
                <Button type="primary" icon={<ReloadOutlined />} onClick={state.loadData}>
                  刷新数据
                </Button>
              </Empty>
            ) : (
              <Table
                columns={columns}
                dataSource={state.filteredTasks}
                loading={state.loading}
                rowKey="id"
                size="middle"
                striped
              />
            )}
          </Card>

          {/* Detail Drawer */}
          <DetailDrawer
            open={state.detailDrawerVisible}
            loading={state.detailLoading}
            selectedTask={state.selectedTask}
            currentUserId={state.currentUserId}
            openClaimModal={state.openClaimModal}
            openCompleteModal={state.openCompleteModal}
            onClose={() => state.setDetailDrawerVisible(false)}
          />

          {/* Claim + Complete Modals */}
          <WorkflowTasksModals
            claimModalVisible={state.claimModalVisible}
            setClaimModalVisible={state.setClaimModalVisible}
            claimForm={state.claimForm}
            claimSubmitting={state.claimSubmitting}
            handleClaim={state.handleClaim}
            completeModalVisible={state.completeModalVisible}
            setCompleteModalVisible={state.setCompleteModalVisible}
            completeForm={state.completeForm}
            completeSubmitting={state.completeSubmitting}
            handleComplete={state.handleComplete}
            validateFormDataJson={state.validateFormDataJson}
          />
        </>
      )}
    </div>
  );
};

export default WorkflowTasksPage;
