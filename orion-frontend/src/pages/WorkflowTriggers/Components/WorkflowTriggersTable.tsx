/**
 * WorkflowTriggers Table
 * 抽取自 index.tsx (P2-9 Phase 131)
 */
import React from 'react';
import { Card, Empty } from 'antd';
import Table from '@/components/Table';
import type { WorkflowTrigger } from '@/api/workflow-trigger';
import type { WorkflowDefinition } from '@/api/workflow';
import { buildWorkflowTriggerColumns } from '../workflowTriggerColumns';

interface WorkflowTriggersTableProps {
  triggers: WorkflowTrigger[];
  loading: boolean;
  workflows: WorkflowDefinition[];
  page: number;
  pageSize: number;
  total: number;
  setPage: (p: number) => void;
  setPageSize: (p: number) => void;
  handleToggle: (trigger: WorkflowTrigger) => void;
  openEdit: (trigger: WorkflowTrigger) => void;
  handleDelete: (id: string) => void;
}

export const WorkflowTriggersTable: React.FC<WorkflowTriggersTableProps> = ({
  triggers,
  loading,
  workflows,
  page,
  pageSize,
  total,
  setPage,
  setPageSize,
  handleToggle,
  openEdit,
  handleDelete,
}) => (
  <Card>
    <Table
      columns={buildWorkflowTriggerColumns({ handleToggle, openEdit, handleDelete, workflows })}
      dataSource={triggers}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
      clientPagination={false}
      pagination={{ current: page, pageSize, total }}
      onPaginationChange={(p, ps) => {
        setPage(p);
        setPageSize(ps);
      }}
      locale={{ emptyText: <Empty description="暂无触发器配置，点击「新建触发器」创建" /> }}
    />
  </Card>
);
