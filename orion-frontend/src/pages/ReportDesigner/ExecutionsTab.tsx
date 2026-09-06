/**
 * ExecutionsTab.tsx - 执行历史 Tab
 * 抽取自 ReportDesigner/index.tsx (P2-9 Phase 51)
 * 刷新按钮 + 执行记录 Table (状态/错误信息/时间)
 */
import React from 'react';
import { Card, Table, Button, Row, Col, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ReportExecution } from '@/api/reports';
import { useExecutionColumns } from './ReportDesignerColumns';

interface ExecutionsTabProps {
  executions: ReportExecution[];
  loading: boolean;
  onRefresh: () => void;
}

export const ExecutionsTab: React.FC<ExecutionsTabProps> = ({ executions, loading, onRefresh }) => {
  const executionColumns = useExecutionColumns();

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <Row justify="space-between" style={{ marginBottom: spacing.md }}>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
        </Col>
      </Row>
      <Table
        columns={executionColumns}
        dataSource={executions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无执行记录" /> }}
      />
    </Card>
  );
};

export default ExecutionsTab;
