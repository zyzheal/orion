/**
 * DataSourcesTab.tsx - 数据源管理 Tab
 * 抽取自 ReportDesigner/index.tsx (P2-9 Phase 51)
 * 刷新/创建按钮 + 数据源 Table (sql/api/promql)
 */
import React from 'react';
import { Card, Table, Button, Row, Col, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ReportDatasource } from '@/api/reports';
import { useDatasourceColumns } from './ReportDesignerColumns';

interface DataSourcesTabProps {
  datasources: ReportDatasource[];
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  handleEditDatasource: (r: ReportDatasource) => void;
  handleDeleteDatasource: (id: string) => void;
}

export const DataSourcesTab: React.FC<DataSourcesTabProps> = (props) => {
  const {
    datasources,
    loading,
    onRefresh,
    onCreate,
    handleEditDatasource,
    handleDeleteDatasource,
  } = props;

  const datasourceColumns = useDatasourceColumns({
    handleEditDatasource,
    handleDeleteDatasource,
  });

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
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            创建数据源
          </Button>
        </Col>
      </Row>
      <Table
        columns={datasourceColumns}
        dataSource={datasources}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无数据源，点击上方按钮创建" /> }}
      />
    </Card>
  );
};

export default DataSourcesTab;
