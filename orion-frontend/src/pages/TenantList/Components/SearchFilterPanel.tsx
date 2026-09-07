/**
 * SearchFilterPanel - 租户搜索和筛选面板
 * 抽取自 index.tsx (P2-9 Phase 109)
 */
import React from 'react';
import { Card, Row, Col, Input, Select, Typography } from 'antd';
import { spacing } from '@/tokens';
import { STATUS_OPTIONS } from '../constants';
import type { TenantListState } from '../useTenantListState';

const { Text } = Typography;

interface SearchFilterPanelProps {
  state: TenantListState;
}

export const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({ state }) => (
  <Card style={{ marginBottom: spacing.md }}>
    <Row gutter={16} align="middle">
      <Col>
        <Input.Search
          placeholder="搜索租户名称/显示名称"
          allowClear
          style={{ width: 250 }}
          onSearch={(value) => state.setSearchText(value)}
          onChange={(e) => state.setSearchText(e.target.value)}
        />
      </Col>
      <Col>
        <Select
          placeholder="筛选状态"
          allowClear
          style={{ width: 150 }}
          value={state.statusFilter}
          onChange={state.setStatusFilter}
          options={STATUS_OPTIONS}
        />
      </Col>
      <Col>
        <Text type="secondary">
          {state.filteredTenants.length !== state.tenants.length
            ? `筛选结果: ${state.filteredTenants.length} / ${state.tenants.length} 个租户`
            : `共 ${state.tenants.length} 个租户`}
        </Text>
      </Col>
    </Row>
  </Card>
);
