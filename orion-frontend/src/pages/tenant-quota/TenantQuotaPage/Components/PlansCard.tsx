/**
 * TenantQuotaPage Plans Card
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Card, Table, Button, Modal, Space, Select, Empty } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import type { QuotaPlan } from '@/api/tenantQuota';
import { buildPlanColumns } from '../columns';

const { Option } = Select;

interface PlansCardProps {
  plans: QuotaPlan[];
  loading: boolean;
  status: string;
  setStatus: (v: string) => void;
  loadPlans: () => void;
  handleCreate: () => void;
  handleViewDetail: (r: QuotaPlan) => void;
  handleEdit: (r: QuotaPlan) => void;
  handleDelete: (id: string) => void;
}

export const PlansCard: React.FC<PlansCardProps> = ({
  plans,
  loading,
  status,
  setStatus,
  loadPlans,
  handleCreate,
  handleViewDetail,
  handleEdit,
  handleDelete,
}) => (
  <Card
    title="配额计划"
    extra={
      <Space>
        <Select
          style={{ width: 120 }}
          value={status}
          onChange={setStatus}
          allowClear
          placeholder="状态"
        >
          <Option value="active">活跃</Option>
          <Option value="inactive">停用</Option>
        </Select>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={loadPlans}
          loading={loading}
        >
          刷新
        </Button>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleCreate}>
          新建计划
        </Button>
      </Space>
    }
  >
    {plans.length === 0 ? (
      <Empty description="暂无配额计划" />
    ) : (
      <Table
        columns={buildPlanColumns({ handleViewDetail, handleEdit, handleDelete })}
        dataSource={plans}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 10 }}
      />
    )}
  </Card>
);
