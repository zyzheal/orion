/**
 * JobListCard.tsx - 作业列表卡（含筛选 toolbar + 空状态 + Table）
 * 抽取自 index.tsx (P2-9 Phase 236)
 */
import React from 'react';
import { Button, Card, Empty, Input, Select, Space, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { TableProps } from 'antd';
import { radius, shadows, spacing } from '@/tokens';
import { JOB_STATUS_OPTIONS, JOB_TYPE_OPTIONS } from '../constants';

const { Option } = Select;
const { Text } = Typography;

interface Props {
  columns: TableProps<any>['columns'];
  filteredJobs: any[];
  loading: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  typeFilter?: string;
  setTypeFilter: (v?: string) => void;
  statusFilter?: string;
  setStatusFilter: (v?: string) => void;
  onCreate: () => void;
}

export const JobListCard: React.FC<Props> = ({
  columns,
  filteredJobs,
  loading,
  searchText,
  setSearchText,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  onCreate,
}) => (
  <Card
    style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
    bodyStyle={{ padding: spacing.md }}
  >
    {/* Toolbar */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
      }}
    >
      <Space>
        <Text type="secondary">共 {filteredJobs.length} 条作业</Text>
      </Space>
      <Space>
        <Input
          placeholder="搜索作业名称 / 标签"
          style={{ width: 220 }}
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Select
          placeholder="作业类型"
          allowClear
          style={{ width: 130 }}
          value={typeFilter}
          onChange={setTypeFilter}
        >
          {JOB_TYPE_OPTIONS.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="状态筛选"
          allowClear
          style={{ width: 130 }}
          value={statusFilter}
          onChange={setStatusFilter}
        >
          {JOB_STATUS_OPTIONS.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建作业
        </Button>
      </Space>
    </div>

    {/* Table or Empty State */}
    {filteredJobs.length === 0 ? (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div style={{ textAlign: 'center' }}>
            <Text type="secondary">暂无自动化作业，点击上方「新建作业」开始创建</Text>
            <div style={{ marginTop: 12 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                新建作业
              </Button>
            </div>
          </div>
        }
      />
    ) : (
      <Table
        dataSource={filteredJobs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 1100 }}
      />
    )}
  </Card>
);
