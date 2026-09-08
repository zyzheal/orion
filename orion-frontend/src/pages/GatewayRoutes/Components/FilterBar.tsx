/**
 * FilterBar.tsx - 筛选栏（搜索 + 5 个下拉 + 清除）
 * 抽取自 index.tsx (P2-9 Phase 231)
 */
import React from 'react';
import { Button, Input, Select } from 'antd';
import { ClearOutlined, SearchOutlined } from '@ant-design/icons';
import { colors, componentRadius, spacing } from '@/tokens';
import { HTTP_METHODS, METHOD_LABELS } from '../constants';

const { Option } = Select;

interface Props {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  methodFilter?: string;
  setMethodFilter: (v?: string) => void;
  statusFilter?: string;
  setStatusFilter: (v?: string) => void;
  authFilter?: string;
  setAuthFilter: (v?: string) => void;
  serviceFilter?: string;
  setServiceFilter: (v?: string) => void;
  uniqueServices: string[];
  onClearFilters: () => void;
}

export const FilterBar: React.FC<Props> = ({
  searchQuery,
  setSearchQuery,
  methodFilter,
  setMethodFilter,
  statusFilter,
  setStatusFilter,
  authFilter,
  setAuthFilter,
  serviceFilter,
  setServiceFilter,
  uniqueServices,
  onClearFilters,
}) => (
  <div
    style={{
      padding: spacing.md,
      borderBottom: `1px solid ${colors.neutral[200]}`,
      display: 'flex',
      flexWrap: 'wrap',
      gap: spacing.sm,
      alignItems: 'center',
    }}
  >
    <Input
      placeholder="搜索路径、服务、描述..."
      prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      style={{ width: 240, borderRadius: componentRadius.input }}
      allowClear
    />
    <Select
      placeholder="HTTP 方法"
      value={methodFilter}
      onChange={(v) => setMethodFilter(v)}
      allowClear
      style={{ width: 120, borderRadius: componentRadius.input }}
    >
      {HTTP_METHODS.map((m) => (
        <Option key={m} value={m}>
          {METHOD_LABELS[m] || m}
        </Option>
      ))}
    </Select>
    <Select
      placeholder="状态"
      value={statusFilter}
      onChange={(v) => setStatusFilter(v)}
      allowClear
      style={{ width: 100, borderRadius: componentRadius.input }}
    >
      <Option value="enabled">已启用</Option>
      <Option value="disabled">已禁用</Option>
    </Select>
    <Select
      placeholder="认证"
      value={authFilter}
      onChange={(v) => setAuthFilter(v)}
      allowClear
      style={{ width: 100, borderRadius: componentRadius.input }}
    >
      <Option value="true">需要</Option>
      <Option value="false">无需</Option>
    </Select>
    <Select
      placeholder="目标服务"
      value={serviceFilter}
      onChange={(v) => setServiceFilter(v)}
      allowClear
      showSearch
      style={{ width: 160, borderRadius: componentRadius.input }}
      filterOption={(input, option) =>
        String(option?.children ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
    >
      {uniqueServices.map((s) => (
        <Option key={s} value={s}>
          {s}
        </Option>
      ))}
    </Select>
    <div style={{ flex: 1 }} />
    <Button icon={<ClearOutlined />} onClick={onClearFilters}>
      清除筛选
    </Button>
  </div>
);
