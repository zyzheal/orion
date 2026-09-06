/**
 * ApprovalPage (Phase 2)
 * 审批工作流页 - 多级审批流程、待审批列表、紧急审批通道
 *
 * 拆分结构（P2-9 Phase 40）:
 * - constants.tsx: statusColorMap/statusLabelMap/APPROVAL_TEMPLATES/ApprovalTemplate
 * - helpers.ts: approvalProgress/getSLAStatus + dayjs relativeTime 扩展
 * - StatsPanel.tsx: 4 张统计卡片
 * - columns.tsx: buildApprovalColumns 表格列
 * - CreateModal.tsx: 创建审批请求 + 模板快速选择
 * - EmergencyModal.tsx: 紧急审批通道
 * - DetailDrawer.tsx: 详情抽屉（Descriptions/Steps/Timeline/操作）
 * - CommentModal.tsx: 通过/拒绝评论弹窗
 * - useApprovalState.ts: 全部 state + 7 个处理函数 + filteredData
 * - ApprovalPage.tsx: Form 实例 + 布局编排
 */
import React, { useMemo } from 'react';
import {
  Typography,
  Card,
  Space,
  Button,
  Form,
  Input,
  Select,
} from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  FireOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import TableComponent from '@/components/Table';
import { StatsPanel } from './StatsPanel';
import { buildApprovalColumns } from './columns';
import { CreateModal } from './CreateModal';
import { EmergencyModal } from './EmergencyModal';
import { DetailDrawer } from './DetailDrawer';
import { CommentModal } from './CommentModal';
import { useApprovalState } from './useApprovalState';

const { Title, Text } = Typography;

const ApprovalPage: React.FC = () => {
  const [createForm] = Form.useForm();
  const [emergencyForm] = Form.useForm();
  const s = useApprovalState(createForm, emergencyForm);

  const columns = useMemo(
    () => buildApprovalColumns({ onOpenDetail: s.openDetail, onOpenComment: s.openCommentModal }),
    [s.openDetail, s.openCommentModal],
  );

  const isInitialLoading = s.loading && s.approvals.length === 0;

  return (
    <div>
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
                审批工作流
              </Title>
              <Text type="secondary">多级审批流程管理，包含待审批列表和紧急审批通道</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={s.loadData} loading={s.loading}>
                刷新
              </Button>
              <Button icon={<FormOutlined />} onClick={s.openCreate}>
                创建审批
              </Button>
              <Button type="primary" danger icon={<FireOutlined />} onClick={s.openEmergency}>
                紧急审批
              </Button>
            </Space>
          </div>

          {/* Stats */}
          <StatsPanel approvals={s.approvals} />

          {/* Filters + Table */}
          <Card>
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
              <Input.Search
                placeholder="搜索审批标题、描述或申请人..."
                allowClear
                style={{ width: 320 }}
                value={s.searchQuery}
                onChange={(e) => s.setSearchQuery(e.target.value)}
                onSearch={s.setSearchQuery}
              />
              <Select
                style={{ width: 140 }}
                value={s.statusFilter}
                onChange={(v) => s.setStatusFilter(v)}
                options={[
                  { label: '全部状态', value: 'all' },
                  { label: '待审批', value: 'pending' },
                  { label: '已通过', value: 'approved' },
                  { label: '已拒绝', value: 'rejected' },
                  { label: '已取消', value: 'cancelled' },
                ]}
              />
            </div>

            <TableComponent
              columns={columns}
              dataSource={s.filteredData}
              loading={s.loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          {/* Modals + Drawer */}
          <CreateModal
            visible={s.createModalVisible}
            onCancel={s.closeCreate}
            onOk={s.handleCreate}
            confirmLoading={s.submitting}
            form={createForm}
            onTemplateSelect={s.handleTemplateSelect}
          />

          <EmergencyModal
            visible={s.emergencyModalVisible}
            onCancel={s.closeEmergency}
            onOk={s.handleEmergencyCreate}
            confirmLoading={s.submitting}
            form={emergencyForm}
          />

          <DetailDrawer
            visible={s.detailDrawerVisible}
            approval={s.selectedApproval}
            onClose={s.closeDetail}
            onOpenComment={s.openCommentModal}
          />

          <CommentModal
            visible={s.commentModalVisible}
            action={s.commentAction}
            text={s.commentText}
            submitting={s.commentSubmitting}
            onTextChange={s.setCommentText}
            onOk={s.handleCommentSubmit}
            onCancel={s.closeComment}
          />
        </>
      )}
    </div>
  );
};

export default ApprovalPage;
