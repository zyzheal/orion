/**
 * FormInstancePipeline InstancesCard
 * 抽取自 index.tsx (P2-9 Phase 176)
 */
import React from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Select,
  Empty,
} from 'antd';
import { ReloadOutlined, SendOutlined } from '@ant-design/icons';
import type { FormInstance, FormDefinition } from '@/api/lowcode';
import type { ColumnsType } from 'antd/es/table';
import { STATUS_OPTIONS } from '../constants';

const { Option } = Select;

interface InstancesCardProps {
  instances: FormInstance[];
  forms: FormDefinition[];
  loading: boolean;
  selectedForm: string;
  setSelectedForm: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  columns: ColumnsType<FormInstance>;
  onLoad: () => void;
  onOpenSubmit: () => void;
}

export const InstancesCard: React.FC<InstancesCardProps> = ({
  instances,
  forms,
  loading,
  selectedForm,
  setSelectedForm,
  status,
  setStatus,
  columns,
  onLoad,
  onOpenSubmit,
}) => (
  <Card
    title="实例列表"
    extra={
      <Space>
        <Select
          style={{ width: 140 }}
          value={selectedForm}
          onChange={setSelectedForm}
          allowClear
          placeholder="选择表单"
        >
          {forms.map((f) => (
            <Option key={f.id} value={f.id}>
              {f.name}
            </Option>
          ))}
        </Select>
        <Select
          style={{ width: 120 }}
          value={status}
          onChange={setStatus}
          allowClear
          placeholder="状态"
        >
          {STATUS_OPTIONS.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Select>
        <Button
          icon={<ReloadOutlined />}
          size="small"
          onClick={onLoad}
          loading={loading}
        >
          刷新
        </Button>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={onOpenSubmit}
        >
          提交实例
        </Button>
      </Space>
    }
  >
    {instances.length === 0 ? (
      <Empty description="暂无表单实例" />
    ) : (
      <Table
        columns={columns}
        dataSource={instances}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        size="small"
      />
    )}
  </Card>
);
