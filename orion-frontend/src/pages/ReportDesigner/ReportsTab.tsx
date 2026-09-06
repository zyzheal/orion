/**
 * ReportsTab.tsx - 报表列表 Tab
 * 抽取自 ReportDesigner/index.tsx (P2-9 Phase 51)
 * 分类筛选 Select + 刷新/创建按钮 + 报表 Table
 */
import React from 'react';
import { Card, Table, Button, Select, Row, Col, Space, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { ReportDefinition } from '@/api/reports';
import { useReportColumns } from './ReportDesignerColumns';

interface ReportsTabProps {
  reports: ReportDefinition[];
  loading: boolean;
  categoryFilter: string | undefined;
  onCategoryChange: (v: string | undefined) => void;
  onRefresh: () => void;
  onCreate: () => void;
  handlePreviewReport: (r: ReportDefinition) => void;
  handleExecuteReport: (id: string) => void;
  handleEditReport: (r: ReportDefinition) => void;
  handleDeleteReport: (id: string) => void;
  categoryOptions: { value: string; label: string }[];
}

export const ReportsTab: React.FC<ReportsTabProps> = (props) => {
  const {
    reports,
    loading,
    categoryFilter,
    onCategoryChange,
    onRefresh,
    onCreate,
    handlePreviewReport,
    handleExecuteReport,
    handleEditReport,
    handleDeleteReport,
    categoryOptions,
  } = props;

  const reportColumns = useReportColumns({
    handlePreviewReport,
    handleExecuteReport,
    handleEditReport,
    handleDeleteReport,
  });

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Select
              placeholder="按分类筛选"
              allowClear
              style={{ width: 160 }}
              value={categoryFilter}
              onChange={onCategoryChange}
              options={categoryOptions}
            />
            <Button icon={<ReloadOutlined />} onClick={onRefresh}>
              刷新
            </Button>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            创建报表
          </Button>
        </Col>
      </Row>
      <Table
        columns={reportColumns}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: <Empty description="暂无报表，点击上方按钮创建" /> }}
      />
    </Card>
  );
};

export default ReportsTab;
