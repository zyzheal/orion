/**
 * Approval Management Page (P2-9 Phase 56)
 * Multi-level approval workflow management (M33)
 * Layout: Header + StatsPanel + Filters + Table + Modals + DetailDrawer
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Input,
  Select,
  Form,
  Card,
  Drawer,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import Table from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useApprovalState } from './useApprovalState';
import { useApprovalColumns } from './ApprovalColumns';
import { ApprovalStatsPanel } from './ApprovalStatsPanel';
import { ApprovalDetailDrawer } from './ApprovalDetailDrawer';
import { ApprovalModals } from './ApprovalModals';

const { Title, Text } = Typography;

const ApprovalManagement: React.FC = () => {
  const state = useApprovalState();
  const {
    loading,
    approvals,
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    createModalVisible, setCreateModalVisible,
    detailDrawerVisible, setDetailDrawerVisible,
    selectedApproval,
    filteredData,
    stats,
    loadData,
    handleCreate,
    openCommentModal,
    openDetail,
    commentModalVisible, setCommentModalVisible,
    commentAction,
    commentText, setCommentText,
    commentSubmitting,
    handleCommentSubmit,
    submitting,
  } = state;

  const [createForm] = Form.useForm();

  // Wrapper: validate form → call hook handler → reset form
  const handleCreateWrapper = async () => {
    try {
      const values = await createForm.validateFields();
      await handleCreate(values);
      createForm.resetFields();
    } catch {
      // Form validation error - handled by Form
    }
  };

  const columns = useApprovalColumns({ openCommentModal, openDetail });

  const isInitialLoading = loading && approvals.length === 0;

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
                <CheckCircleOutlined
                  style={{ marginRight: spacing[3], color: colors.primary[500] }}
                />
                审批管理
              </Title>
              <Text type="secondary">管理多级审批流程，包括创建、审批和跟踪</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建审批
              </Button>
            </Space>
          </div>

          {/* Stats Panel */}
          <ApprovalStatsPanel stats={stats} />

          {/* Filters */}
          <Card>
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
              <Input.Search
                placeholder="搜索审批标题、描述或申请人..."
                allowClear
                style={{ width: 320 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={setSearchQuery}
              />
              <Select
                style={{ width: 140 }}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[
                  { label: '全部状态', value: 'all' },
                  { label: '待审批', value: 'pending' },
                  { label: '已通过', value: 'approved' },
                  { label: '已拒绝', value: 'rejected' },
                  { label: '已取消', value: 'cancelled' },
                ]}
              />
            </div>

            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          {/* Detail Drawer */}
          <Drawer
            title={selectedApproval ? selectedApproval.title : '审批详情'}
            open={detailDrawerVisible}
            onClose={() => setDetailDrawerVisible(false)}
            width={720}
            destroyOnClose
          >
            {selectedApproval && (
              <ApprovalDetailDrawer
                approval={selectedApproval}
                openCommentModal={openCommentModal}
              />
            )}
          </Drawer>

          {/* Modals */}
          <ApprovalModals
            createModalVisible={createModalVisible}
            setCreateModalVisible={setCreateModalVisible}
            createForm={createForm}
            submitting={submitting}
            handleCreate={handleCreateWrapper}
            commentModalVisible={commentModalVisible}
            setCommentModalVisible={setCommentModalVisible}
            commentAction={commentAction}
            commentText={commentText}
            setCommentText={setCommentText}
            commentSubmitting={commentSubmitting}
            handleCommentSubmit={handleCommentSubmit}
          />
        </>
      )}
    </div>
  );
};

export default ApprovalManagement;
