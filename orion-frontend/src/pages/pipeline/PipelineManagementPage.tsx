/**
 * Data Pipeline Management Page
 * 完整的数据管道管理页面：列表、CRUD、运行/暂停/恢复、状态监控、空状态引导
 *
 * 对接后端 /api/v1/data-pipeline 路由
 *
 * 重构自 P2-9 Phase 90 (647 → ~135 行):
 *  - constants.ts - statusConfig / STATUS_FILTER_OPTIONS
 *  - usePipelineManagementState.ts - 全部状态 + loader + 6 CRUD + 3 运行 + 2 视图 handler
 *  - columns.tsx - StatusTag + makePipelineColumns
 *  - Modals/PipelineFormModal.tsx - 创建/编辑弹窗
 *  - Components/DetailDrawer.tsx - 日志/血缘抽屉
 */
import React from 'react';
import { Typography, Button, Space, Card, Row, Col, Input, Select, Empty } from 'antd';
import {
  CloudUploadOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TableCustom from '@/components/Table';
import { colors, spacing } from '@/tokens';
import { usePipelineManagementState } from './usePipelineManagementState';
import { makePipelineColumns } from './columns';
import { PipelineFormModal } from './Modals/PipelineFormModal';
import { DetailDrawer } from './Components/DetailDrawer';
import { STATUS_FILTER_OPTIONS } from './constants';

const { Title, Text } = Typography;

const PipelineManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    pipelines,
    loading,
    actionLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    modalOpen,
    editingPipeline,
    modalLoading,
    form,
    drawerOpen,
    drawerTitle,
    drawerContent,
    drawerLoading,
    selectedPipelineName,
    loadPipelines,
    handleCreateOrEdit,
    handleOpenCreate,
    handleOpenEdit,
    handleDelete,
    handleRun,
    handlePause,
    handleResume,
    handleViewLogs,
    handleViewLineage,
    handleCloseModal,
    handleCloseDrawer,
    filteredPipelines,
  } = usePipelineManagementState();

  const columns = React.useMemo(
    () =>
      makePipelineColumns({
        navigate,
        actionLoading,
        handleOpenEdit,
        handleDelete,
        handleRun,
        handlePause,
        handleResume,
        handleViewLogs,
        handleViewLineage,
      }),
    [navigate, actionLoading, handleOpenEdit, handleDelete, handleRun, handlePause, handleResume, handleViewLogs, handleViewLineage]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      {/* 页面头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title
            level={2}
            style={{
              marginBottom: spacing.sm,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            数据管道管理
          </Title>
          <Text type="secondary">
            ETL 管道配置、调度与监控 · 共 {filteredPipelines.length} 条管道
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadPipelines} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            创建管道
          </Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: spacing.md, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Row gutter={spacing.md} align="middle">
          <Col flex="auto">
            <Input
              placeholder="搜索管道名称、描述、表名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
          </Col>
          <Col>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTER_OPTIONS}
              style={{ width: 140 }}
            />
          </Col>
        </Row>
      </Card>

      {/* 管道列表 */}
      {filteredPipelines.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 0' }}>
          <Empty
            description={
              <Text type="secondary">
                {pipelines.length === 0
                  ? '暂无数据管道，点击上方按钮创建第一个管道'
                  : '没有匹配的管道'}
              </Text>
            }
          />
          {pipelines.length === 0 && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              style={{ marginTop: spacing.md }}
            >
              创建数据管道
            </Button>
          )}
        </Card>
      ) : (
        <TableCustom
          columns={columns}
          dataSource={filteredPipelines}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          pagination={{
            current: 1,
            pageSize: 10,
            total: pipelines.length,
          }}
        />
      )}

      {/* 创建/编辑弹窗 */}
      <PipelineFormModal
        open={modalOpen}
        editingPipeline={editingPipeline}
        loading={modalLoading}
        form={form}
        onCancel={handleCloseModal}
        onFinish={handleCreateOrEdit}
      />

      {/* 日志/血缘抽屉 */}
      <DetailDrawer
        open={drawerOpen}
        title={drawerTitle}
        content={drawerContent}
        loading={drawerLoading}
        selectedName={selectedPipelineName}
        onClose={handleCloseDrawer}
      />
    </div>
  );
};

export default PipelineManagementPage;
