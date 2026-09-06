/**
 * VersionsTab.tsx - CI 版本历史
 * 抽取自 CITypeDesigner/index.tsx (P2-9 Phase 52)
 * 类型选择器 + 创建版本快照按钮 + 版本表格
 */
import { Card, Table, Row, Col, Space, Select, Button, Empty } from 'antd';
import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import type { CIType, CITypeVersion } from '@/api/ci-types';
import { spacing, componentRadius, shadows } from '@/tokens';
import { useVersionColumns, type VersionColumnsHandlers } from './CITypeDesignerColumns';

interface VersionsTabProps {
  ciTypes: CIType[];
  versionTypeId: string | undefined;
  onVersionTypeChange: (v: string | undefined) => void;
  versions: CITypeVersion[];
  versionsLoading: boolean;
  onRefresh: () => void;
  onCreateVersion: () => void;
  handleRollback: (version: CITypeVersion) => void;
}

export const VersionsTab: React.FC<VersionsTabProps> = (props) => {
  const handlers: VersionColumnsHandlers = {
    handleRollback: props.handleRollback,
  };
  const columns = useVersionColumns(handlers);

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
              value={props.versionTypeId}
              onChange={props.onVersionTypeChange}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            />
            {props.versionTypeId && (
              <Button icon={<ReloadOutlined />} onClick={props.onRefresh}>
                刷新
              </Button>
            )}
          </Space>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<HistoryOutlined />}
            onClick={props.onCreateVersion}
            disabled={!props.versionTypeId}
          >
            创建版本快照
          </Button>
        </Col>
      </Row>

      {!props.versionTypeId ? (
        <Empty description="请先选择一个 CI 类型" />
      ) : (
        <Table
          columns={columns}
          dataSource={props.versions}
          rowKey="id"
          loading={props.versionsLoading}
          pagination={{ pageSize: 20 }}
        />
      )}
    </Card>
  );
};
