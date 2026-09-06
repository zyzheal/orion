/**
 * DefinitionsTab.tsx - SLA 定义 Tab (筛选 + 创建按钮 + 表格)
 * 抽取自 SLA/index.tsx (P2-9 Phase 55)
 */
import React, { useMemo } from 'react';
import { Button, Space, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import { spacing } from '@/tokens';
import type { SLADefinition } from '@/api/sla';
import { TYPE_OPTIONS, DEF_STATUS_OPTIONS } from './config';
import { getDefColumns } from './columns';

export interface DefinitionsTabProps {
  definitions: SLADefinition[];
  defTotal: number;
  loading: boolean;
  defTypeFilter: string | undefined;
  setDefTypeFilter: (v: string | undefined) => void;
  defStatusFilter: string | undefined;
  setDefStatusFilter: (v: string | undefined) => void;
  handleOpenCreateDefModal: () => void;
  handleOpenEditDefModal: (record: SLADefinition) => void;
  handleDeleteDefinition: (id: string) => void;
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: spacing.md,
  flexWrap: 'wrap',
  gap: spacing.sm,
};

export const DefinitionsTab: React.FC<DefinitionsTabProps> = (props) => {
  const {
    definitions,
    loading,
    defTypeFilter,
    setDefTypeFilter,
    defStatusFilter,
    setDefStatusFilter,
    handleOpenCreateDefModal,
    handleOpenEditDefModal,
    handleDeleteDefinition,
  } = props;

  const defColumns = useMemo(
    () => getDefColumns({ onEdit: handleOpenEditDefModal, onDelete: handleDeleteDefinition }),
    [handleOpenEditDefModal, handleDeleteDefinition],
  );

  return (
    <>
      <div style={toolbarStyle}>
        <Space size="middle" wrap>
          <Select
            placeholder="类型筛选"
            allowClear
            style={{ width: 140 }}
            value={defTypeFilter}
            onChange={setDefTypeFilter}
            options={[TYPE_OPTIONS].slice()}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 120 }}
            value={defStatusFilter}
            onChange={setDefStatusFilter}
            options={[DEF_STATUS_OPTIONS].slice()}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateDefModal}>
          创建 SLA
        </Button>
      </div>
      <Table columns={defColumns} dataSource={definitions} loading={loading} rowKey="id" size="middle" striped />
    </>
  );
};
