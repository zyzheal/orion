/**
 * I18nManagement TranslationsTab
 * 抽取自 index.tsx (P2-9 Phase 197)
 */
import { Button, Card, Col, Empty, Row, Select, Space, Table, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { spacing } from '@/tokens';
import type { I18nLocale } from '@/api/i18n';
import type { TranslationRow } from '../columns';

interface TranslationsTabProps {
  locales: I18nLocale[];
  selectedLocale: string;
  translations: TranslationRow[];
  loading: boolean;
  columns: ColumnsType<TranslationRow>;
  onLocaleChange: (v: string) => void;
  onRefresh: () => void;
  onAdd: () => void;
}

export const TranslationsTab = ({
  locales,
  selectedLocale,
  translations,
  loading,
  columns,
  onLocaleChange,
  onRefresh,
  onAdd,
}: TranslationsTabProps) => (
  <Card>
    <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
      <Col>
        <Space>
          <Typography.Text>当前语言:</Typography.Text>
          <Select
            value={selectedLocale}
            onChange={onLocaleChange}
            style={{ width: 200 }}
            placeholder="选择语言"
          >
            {locales.map((loc) => (
              <Select.Option key={loc.code} value={loc.code}>
                {loc.name} ({loc.code})
              </Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
        </Space>
      </Col>
      <Col>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAdd}
          disabled={!selectedLocale}
        >
          添加翻译
        </Button>
      </Col>
    </Row>
    {selectedLocale ? (
      <Table
        columns={columns}
        dataSource={translations}
        rowKey="key"
        loading={loading}
        pagination={{ pageSize: 50 }}
      />
    ) : (
      <Empty description="请先选择语言" />
    )}
  </Card>
);
