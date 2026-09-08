/**
 * Workspace Management Page (KubeSphere-style)
 * Multi-tenant workspace isolation: CRUD, resource quota, member roles
 *
 * 拆分自 index.tsx (P2-9 Phase 221)
 * - workspaceApi.ts: apiCall + Workspace 类型
 * - useWorkspaceState.ts: state + useQuery/useMutation + handlers
 * - components/WorkspaceColumns.tsx: 8 列表格列定义
 * - components/WorkspaceStatsCards.tsx: 4 张统计卡
 * - components/WorkspaceModal.tsx: 创建/编辑表单 Modal
 * - index.tsx: 组合层
 */
import { Button, Card, Empty, Space, Table, Typography } from 'antd';
import {
  PlusOutlined,
  ProjectOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useWorkspaceState } from './useWorkspaceState';
import { buildWorkspaceColumns } from './components/WorkspaceColumns';
import { WorkspaceStatsCards } from './components/WorkspaceStatsCards';
import { WorkspaceModal } from './components/WorkspaceModal';

const { Title, Text } = Typography;

const WorkspacePage = () => {
  const {
    modalOpen,
    editing,
    form,
    loading,
    workspaces,
    activeCount,
    totalCpu,
    totalMemory,
    upsertSaving,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSave,
    handleCancel,
    handleRefresh,
  } = useWorkspaceState();

  const columns = buildWorkspaceColumns({ onEdit: handleEdit, onDelete: handleDelete });

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ProjectOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        多租户工作空间管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        KubeSphere Workspace 模式 · 资源隔离 · 配额管理 · 成员角色
      </Text>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <WorkspaceStatsCards
            totalCount={workspaces.length}
            activeCount={activeCount}
            totalCpu={totalCpu}
            totalMemory={totalMemory}
          />

          <Card
            title="工作空间列表"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  创建工作空间
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={workspaces}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: (
                  <Empty description="暂无工作空间，请创建工作空间以实现多租户隔离" />
                ),
              }}
            />
          </Card>
        </>
      )}

      <WorkspaceModal
        editing={editing}
        open={modalOpen}
        confirmLoading={upsertSaving}
        form={form}
        onOk={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default WorkspacePage;
