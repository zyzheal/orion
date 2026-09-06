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
 */
import React from 'react';
import { Typography, Button, Space, Card, Select, Statistic, Row, Col, Table } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useQueueState } from './useQueueState';
import { makeQueueJobColumns } from './columns';
import { EnqueueModal } from './Modals/EnqueueModal';
import { DequeueModal } from './Modals/DequeueModal';
import { DetailDrawer } from './Components/DetailDrawer';

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

      {/* Stats Panel */}
      {stats && (
        <Card size="small" style={{ marginBottom: spacing.md }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="等待中"
                value={stats.pending}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: colors.primary[500] }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="处理中"
                value={stats.processing}
                prefix={<SyncOutlined spin />}
                valueStyle={{ color: colors.warning[500] }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已完成"
                value={stats.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: colors.success[500] }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已失败"
                value={stats.failed}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: colors.error[400] }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: spacing.md }}>
        <Space>
          <Text>状态筛选:</Text>
          <Select
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: '全部', value: 'all' },
              { label: '等待中', value: 'pending' },
              { label: '处理中', value: 'processing' },
              { label: '已完成', value: 'completed' },
              { label: '已失败', value: 'failed' },
            ]}
          />
          <Text style={{ marginLeft: spacing.md }}>队列筛选:</Text>
          <Select
            style={{ width: 160 }}
            value={queueFilter}
            onChange={setQueueFilter}
            options={[
              { label: '全部', value: 'all' },
              ...queueNames.map((n) => ({ label: n, value: n })),
            ]}
          />
        </Space>
      </Card>

      {/* Job List */}
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

      {/* Enqueue Modal */}
      <EnqueueModal
        open={enqueueModalVisible}
        form={enqueueForm}
        submitting={submitting}
        onCancel={() => setEnqueueModalVisible(false)}
        onOk={handleEnqueue}
      />

      {/* Dequeue Modal */}
      <DequeueModal
        open={dequeueModalVisible}
        form={dequeueForm}
        submitting={submitting}
        onCancel={() => setDequeueModalVisible(false)}
        onOk={handleDequeue}
      />

      {/* Detail Drawer */}
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
