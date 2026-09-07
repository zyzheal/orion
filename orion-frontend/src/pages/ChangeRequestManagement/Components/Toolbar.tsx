/**
 * Toolbar - 页面顶部工具栏
 * 抽取自 index.tsx (P2-9 Phase 110)
 */
import React from 'react';
import { Row, Col, Space, Select, Button } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { statusLabel } from '../config';
import type { ChangeRequestManagementState } from '../useChangeRequestManagementState';

interface ToolbarProps {
  state: ChangeRequestManagementState;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state }) => (
  <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
    <Col>
      <Space>
        <Select
          placeholder="按状态筛选"
          allowClear
          style={{ width: 160 }}
          value={state.statusFilter}
          onChange={(val) => state.setStatusFilter(val)}
        >
          {Object.entries(statusLabel).map(([key, label]) => (
            <Select.Option key={key} value={key}>
              {label}
            </Select.Option>
          ))}
        </Select>
        <Button icon={<ReloadOutlined />} onClick={state.fetchRequests}>
          刷新
        </Button>
      </Space>
    </Col>
    <Col>
      <Button type="primary" icon={<PlusOutlined />} onClick={state.handleCreate}>
        创建变更请求
      </Button>
    </Col>
  </Row>
);
