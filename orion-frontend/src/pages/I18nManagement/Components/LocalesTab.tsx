/**
 * I18nManagement LocalesTab
 * 抽取自 index.tsx (P2-9 Phase 197)
 */
import { Button, Card, Col, Row, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';
import type { I18nLocale } from '@/api/i18n';

interface LocalesTabProps {
  locales: I18nLocale[];
  loading: boolean;
  columns: ColumnsType<I18nLocale>;
  onRefresh: () => void;
  onAdd: () => void;
  onSelect: (code: string) => void;
}

export const LocalesTab = ({
  locales,
  loading,
  columns,
  onRefresh,
  onAdd,
  onSelect,
}: LocalesTabProps) => (
  <Card>
    <Row justify="space-between" style={{ marginBottom: spacing.md }}>
      <Col>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      </Col>
      <Col>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
          添加语言
        </Button>
      </Col>
    </Row>
    <Table
      columns={columns}
      dataSource={locales}
      rowKey="id"
      loading={loading}
      pagination={false}
      onRow={(record) => ({
        onClick: () => onSelect(record.code),
        style: { cursor: 'pointer' },
      })}
    />
  </Card>
);
