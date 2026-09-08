/**
 * ABAC Policy Management Page
 * 策略管理界面
 *
 * 拆分自 index.tsx (P2-9 Phase 202)
 * - useABACPolicyState.ts: state + fetch/create/update/delete/toggle
 * - columns.tsx: 8 列表格定义
 * - constants.ts: 资源/操作/效果选项
 * - Components/PolicyModal.tsx: 新建/编辑策略弹窗
 * - Components/PolicyDetailDrawer.tsx: 策略详情抽屉
 */
import { useMemo } from 'react';
import { Button, Card, Space, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useABACPolicyState } from './useABACPolicyState';
import { buildColumns } from './columns';
import { PolicyModal } from './Components/PolicyModal';
import { PolicyDetailDrawer } from './Components/PolicyDetailDrawer';

const ABACPolicyManagement = () => {
  const {
    loading,
    policies,
    modalOpen,
    setModalOpen,
    drawerOpen,
    setDrawerOpen,
    selectedPolicy,
    setSelectedPolicy,
    form,
    fetchPolicies,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleToggle,
    openEdit,
    openDetail,
    openCreate,
    closeCreate,
  } = useABACPolicyState();

  const columns = useMemo(
    () =>
      buildColumns({
        onOpenDetail: openDetail,
        onToggle: handleToggle,
        onEdit: openEdit,
        onDelete: handleDelete,
      }),
    [openDetail, handleToggle, openEdit, handleDelete]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <Card
        title="ABAC 策略管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchPolicies}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建策略
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={policies}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={ { pageSize: 10 } }
        />
      </Card>

      <PolicyModal
        open={modalOpen}
        selectedPolicy={selectedPolicy}
        form={form}
        onOk={selectedPolicy ? handleUpdate : handleCreate}
        onCancel={closeCreate}
      />

      <PolicyDetailDrawer
        open={drawerOpen}
        policy={selectedPolicy}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedPolicy(null);
        }}
      />
    </div>
  );
};

export default ABACPolicyManagement;
