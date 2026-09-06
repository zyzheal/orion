/**
 * TypesTab.tsx - CI 类型列表
 * 抽取自 CITypeDesigner/index.tsx (P2-9 Phase 52)
 * 分类筛选 + 刷新/创建按钮 + 表格
 */
import { Card, Table, Row, Col, Space, Select, Button } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { CIType } from '@/api/ci-types';
import { spacing, componentRadius, shadows } from '@/tokens';
import { categoryOptions, useTypeColumns, type TypeColumnsHandlers } from './CITypeDesignerColumns';

interface TypesTabProps {
  ciTypes: CIType[];
  typesLoading: boolean;
  categoryFilter: string | undefined;
  onCategoryChange: (v: string | undefined) => void;
  onRefresh: () => void;
  onCreate: () => void;
  handleViewDetail: (record: CIType) => void;
  handleEditType: (record: CIType) => void;
  handleOpenValidate: (record: CIType) => void;
  handleDeleteType: (id: string) => void;
}

export const TypesTab: React.FC<TypesTabProps> = (props) => {
  const handlers: TypeColumnsHandlers = {
    handleViewDetail: props.handleViewDetail,
    handleEditType: props.handleEditType,
    handleOpenValidate: props.handleOpenValidate,
    handleDeleteType: props.handleDeleteType,
  };
  const columns = useTypeColumns(handlers);

  return (
    <Card style={{ borderRadius: componentRadius.card, boxShadow: shadows.card as string }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Select
              placeholder="按分类筛选"
              allowClear
              style={{ width: 160 }}
              options={categoryOptions}
              value={props.categoryFilter}
              onChange={props.onCategoryChange}
            />
            <Button icon={<ReloadOutlined />} onClick={props.onRefresh}>
              刷新
            </Button>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={props.onCreate}>
            创建 CI 类型
          </Button>
        </Col>
      </Row>
      <Table
        columns={columns}
        dataSource={props.ciTypes}
        rowKey="id"
        loading={props.typesLoading}
        pagination={{ pageSize: 20 }}
      />
    </Card>
  );
};
