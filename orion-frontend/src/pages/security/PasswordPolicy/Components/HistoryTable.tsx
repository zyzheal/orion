/**
 * PasswordPolicy history table
 * 抽取自 index.tsx (P2-9 Phase 144)
 */
import React, { useMemo } from 'react';
import { Card, Empty, Space, Table } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { MOCK_HISTORY_DATA } from '../helpers';
import { buildHistoryColumns } from '../historyColumns';

export const HistoryTable: React.FC = () => (
  <Card
    title={
      <Space>
        <HistoryOutlined />
        <span>密码修改历史（最近记录）</span>
      </Space>
    }
    style={{
      marginTop: spacing.lg,
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    }}
  >
    <Table
      columns={useMemo(() => buildHistoryColumns(), [])}
      dataSource={MOCK_HISTORY_DATA}
      rowKey="key"
      size="middle"
      pagination={{ pageSize: 5, showSizeChanger: false }}
      style={{ marginTop: spacing.sm }}
      locale={{
        emptyText: (
          <Empty description="密码变更历史 API 开发中" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ),
      }}
    />
  </Card>
);
