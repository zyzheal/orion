/**
 * AttributesTab.tsx - CI 属性管理
 * 抽取自 CITypeDesigner/index.tsx (P2-9 Phase 52)
 * 类型选择器 + 刷新/创建按钮 + 属性表格
 */
import { Card, Table, Row, Col, Space, Select, Button, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { CIType, CIAttribute } from '@/api/ci-types';
import { spacing, componentRadius, shadows } from '@/tokens';
import { useAttrColumns, type AttrColumnsHandlers } from './CITypeDesignerColumns';

interface AttributesTabProps {
  ciTypes: CIType[];
  selectedTypeId: string | undefined;
  onSelectType: (v: string | undefined) => void;
  attributes: CIAttribute[];
  attrsLoading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  handleEditAttr: (record: CIAttribute) => void;
  handleDeleteAttr: (record: CIAttribute) => void;
}

export const AttributesTab: React.FC<AttributesTabProps> = (props) => {
  const handlers: AttrColumnsHandlers = {
    handleEditAttr: props.handleEditAttr,
    handleDeleteAttr: props.handleDeleteAttr,
  };
  const columns = useAttrColumns(handlers);

  const typeSelectOptions = props.ciTypes.map((t) => ({
    label: t.displayName ? `${t.displayName} (${t.name})` : t.name,
    value: t.id,
  }));

  return (
    <Card style={{ borderRadius: componentRadius.card, boxShadow: shadows.card as string }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
        <Col>
          <Space>
            <Select
              placeholder="选择 CI 类型"
              style={{ width: 280 }}
              options={typeSelectOptions}
              value={props.selectedTypeId}
              onChange={props.onSelectType}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            />
            {props.selectedTypeId && (
              <Button icon={<ReloadOutlined />} onClick={props.onRefresh}>
                刷新
              </Button>
            )}
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={props.onCreate}
            disabled={!props.selectedTypeId}
          >
            添加属性
          </Button>
        </Col>
      </Row>

      {!props.selectedTypeId ? (
        <Empty description="请先选择一个 CI 类型" />
      ) : (
        <Table
          columns={columns}
          dataSource={props.attributes}
          rowKey="id"
          loading={props.attrsLoading}
          pagination={false}
        />
      )}
    </Card>
  );
};
