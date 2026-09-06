/**
 * Automation — 自动化作业与工具库管理页面
 *
 * FE-02: 自动化作业管理 (AutoJob CRUD + 执行 + 历史)
 *
 * 拆分结构（P2-9 Phase 32）:
 * - useAutomationState.ts: 全部状态 + loadJobs + 7 个 CRUD/执行/历史处理器 + filteredJobs/stats
 * - constants.tsx: 作业/执行类型/状态颜色标签映射 + JOB_TYPE_OPTIONS/JOB_STATUS_OPTIONS + parseJSON/formatShortDate
 * - JobTableColumns.tsx: 8 列表格配置 Hook (名称/类型/状态/启用/调度/标签/创建时间/操作)
 * - ExecutionHistoryColumns.tsx: 6 列执行历史表格配置
 * - StatsBar.tsx: 4 项统计条
 * - JobModal.tsx: 新建/编辑作业 Modal (含 Cron 校验 + JSON config)
 * - ExecutionHistoryDrawer.tsx: 执行历史 Drawer (作业详情 Descriptions + 执行表)
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Table,
  Card,
  Input,
  Select,
  Tooltip,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing, radius, shadows } from '@/tokens';
import { useAutomationState } from './useAutomationState';
import { useJobTableColumns } from './JobTableColumns';
import { StatsBar } from './StatsBar';
import { JobModal } from './JobModal';
import { ExecutionHistoryDrawer } from './ExecutionHistoryDrawer';
import { JOB_TYPE_OPTIONS, JOB_STATUS_OPTIONS } from './constants';

const { Title, Text } = Typography;
const { Option } = Select;

const Automation: React.FC = () => {
  const {
    loading,
    saving,
    executing,
    togglingId,
    searchText,
    setSearchText,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    modalOpen,
    setModalOpen,
    editingJob,
    drawerOpen,
    setDrawerOpen,
    currentJob,
    executions,
    execLoading,
    filteredJobs,
    stats,
    loadJobs,
    handleOpenCreate,
    handleOpenEdit,
    handleSave,
    handleDelete,
    handleToggle,
    handleExecute,
    handleViewExecutions,
  } = useAutomationState();

  const columns = useJobTableColumns({
    executing,
    togglingId,
    handleToggle,
    handleExecute,
    handleViewExecutions,
    handleOpenEdit,
    handleDelete,
  });

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
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            自动化作业
          </Title>
          <Text type="secondary">
            管理和执行自动化作业，支持脚本、工具调用、复合工具与 API 调用
          </Text>
        </div>
        <Tooltip title="刷新作业列表">
          <Button icon={<ReloadOutlined />} loading={loading} disabled={loading} onClick={loadJobs}>
            刷新
          </Button>
        </Tooltip>
      </div>

      <StatsBar stats={stats} />

      {/* Job List Card */}
      <Card
        style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
        bodyStyle={{ padding: spacing.md }}
      >
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Space>
            <Text type="secondary">共 {filteredJobs.length} 条作业</Text>
          </Space>
          <Space>
            <Input
              placeholder="搜索作业名称 / 标签"
              style={{ width: 220 }}
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select
              placeholder="作业类型"
              allowClear
              style={{ width: 130 }}
              value={typeFilter}
              onChange={setTypeFilter}
            >
              {JOB_TYPE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 130 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              {JOB_STATUS_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              新建作业
            </Button>
          </Space>
        </div>

        {/* Table or Empty State */}
        {filteredJobs.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">暂无自动化作业，点击上方「新建作业」开始创建</Text>
                <div style={{ marginTop: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    新建作业
                  </Button>
                </div>
              </div>
            }
          />
        ) : (
          <Table
            dataSource={filteredJobs}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 1100 }}
          />
        )}
      </Card>

      {/* Create / Edit Job Modal */}
      <JobModal
        open={modalOpen}
        editingJob={editingJob}
        saving={saving}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      />

      {/* Execution History Drawer */}
      <ExecutionHistoryDrawer
        open={drawerOpen}
        currentJob={currentJob}
        executions={executions}
        execLoading={execLoading}
        onClose={() => setDrawerOpen(false)}
        onRefresh={handleViewExecutions}
      />
    </div>
  );
};

export default Automation;
