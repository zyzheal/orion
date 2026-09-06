/**
 * FinOps 预算管理 Tab
 *
 * 预算列表 + 创建/编辑入口 + 删除确认，表单与弹窗见 FinOpsModals.tsx。
 */
import React from 'react';
import { Button, Empty, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

import type { Budget } from '@/types/finops';
import { spacing } from '@/tokens';
import { buildBudgetColumns } from './columns';
import { BudgetModal } from './FinOpsModals';

const { Text } = Typography;

export interface BudgetTabProps {
  budgets: Budget[];
  loading: boolean;
  budgetModalOpen: boolean;
  editing: boolean;
  budgetSubmitting: boolean;
  form: import('antd').FormInstance;
  onOpenModal: (budget?: Budget) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

export const BudgetTab: React.FC<BudgetTabProps> = ({
  budgets,
  loading,
  budgetModalOpen,
  editing,
  budgetSubmitting,
  form,
  onOpenModal,
  onSubmit,
  onCancel,
  onDelete,
}) => (
  <div>
    <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
      <Text type="secondary">管理项目/租户/团队的预算配置</Text>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpenModal()}>
        创建预算
      </Button>
    </div>

    <Table<Budget>
      columns={buildBudgetColumns({ onEdit: onOpenModal, onDelete })}
      dataSource={budgets}
      rowKey="id"
      loading={loading}
      locale={{
        emptyText: (
          <Empty description="暂无预算配置" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" onClick={() => onOpenModal()}>
              <PlusOutlined /> 创建第一个预算
            </Button>
          </Empty>
        ),
      }}
    />

    <BudgetModal
      open={budgetModalOpen}
      editing={editing}
      confirmLoading={budgetSubmitting}
      form={form}
      onOk={onSubmit}
      onCancel={onCancel}
    />
  </div>
);
