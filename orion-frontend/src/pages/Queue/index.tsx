/**
 * Queue Management Page
 * Queue job monitoring, enqueue/dequeue operations, and statistics
 *
 * 重构自 P2-9 Phase 87 (654 → ~180 lines):
 *  - constants.tsx - 状态色/标签/图标映射
 *  - useQueueState.ts - 状态与业务逻辑 Hook
 *  - columns.tsx - 任务表格列定义
 *  - Modals/EnqueueModal.tsx - 入队弹窗
 *  - Modals/DequeueModal.tsx - 出队弹窗
 *  - Components/DetailDrawer.tsx - 详情抽屉
 *  - Components/QueueStatsPanel.tsx - 队列统计卡
 *  - Components/QueueFilterBar.tsx - 队列筛选栏
 *  - index.tsx: 组合层
 */
import React from 'react';
import { Button, Card, Space, Table, Typography } from 'antd';
import {
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useQueueState } from './useQueueState';
import { makeQueueJobColumns } from './columns';
import { EnqueueModal } from './Modals/EnqueueModal';
import { DequeueModal } from './Modals/DequeueModal';
import { DetailDrawer } from './Components/DetailDrawer';
import { QueueStatsPanel } from './Components/QueueStatsPanel';
import { QueueFilterBar } from './Components/QueueFilterBar';

const { Title, Text } = Typography;

const QueueManagement: React.FC = () => {
  const {
    loading,
    jobs,
    stats,
    statusFilter,
    setStatusFilter,
    queueFilter,
    setQueueFilter,
    enqueueModalVisible,
    setEnqueueModalVisible,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedJob,
    dequeueModalVisible,
    setDequeueModalVisible,
    enqueueForm,
    dequeueForm,
    submitting,
    queueNames,
    loadData,
    loadStats,
    handleEnqueue,
    handleDequeue,
    handleComplete,
    handleFail,
    openDetail,
    openEnqueue,
    openDequeue,
  } = useQueueState();

  const columns = makeQueueJobColumns(openDetail, handleComplete, handleFail);

  return (
    <div style={{ padding: 0 }}>
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
            <InboxOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            队列管理
          </Title>
          <Text type="secondary">管理异步任务队列，监控任务执行状态</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadData();
              loadStats();
            }}
            loading={loading}
          >
            刷新
          </Button>
          <Button icon={<InboxOutlined />} onClick={openDequeue}>
            出队
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openEnqueue}>
            入队
          </Button>
        </Space>
      </div>

      <QueueStatsPanel stats={stats} />

      <QueueFilterBar
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        queueFilter={queueFilter}
        setQueueFilter={setQueueFilter}
        queueNames={queueNames}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={jobs}
          loading={loading}
          rowKey="id"
          size="middle"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 个任务`,
          }}
        />
      </Card>

      <EnqueueModal
        open={enqueueModalVisible}
        form={enqueueForm}
        submitting={submitting}
        onCancel={() => setEnqueueModalVisible(false)}
        onOk={handleEnqueue}
      />

      <DequeueModal
        open={dequeueModalVisible}
        form={dequeueForm}
        submitting={submitting}
        onCancel={() => setDequeueModalVisible(false)}
        onOk={handleDequeue}
      />

      <DetailDrawer
        open={detailDrawerVisible}
        selectedJob={selectedJob}
        onClose={() => setDetailDrawerVisible(false)}
        handleComplete={handleComplete}
        handleFail={handleFail}
      />
    </div>
  );
};

export default QueueManagement;
