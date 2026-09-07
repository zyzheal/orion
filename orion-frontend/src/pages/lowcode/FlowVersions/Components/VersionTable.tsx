/**
 * FlowVersions VersionTable
 * 抽取自 index.tsx (P2-9 Phase 184)
 */
import { Card, Button, Space, Table, Empty, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { LowcodeFlow, LowcodeFlowVersion } from '@/api/lowcode';
import { colors, spacing } from '@/tokens';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface VersionTableProps {
  columns: ColumnsType<LowcodeFlowVersion>;
  dataSource: LowcodeFlowVersion[];
  selectedFlow: LowcodeFlow | null;
  versionLoading: boolean;
  totalVersions: number;
  onCreateVersion: () => void;
}

export const VersionTable = ({
  columns,
  dataSource,
  selectedFlow,
  versionLoading,
  totalVersions,
  onCreateVersion,
}: VersionTableProps) => (
  <Card
    title={
      <Space>
        <span>版本历史</span>
        {selectedFlow && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onCreateVersion}>
            创建版本快照
          </Button>
        )}
      </Space>
    }
    extra={selectedFlow && <Text type="secondary">共 {totalVersions} 个版本</Text>}
  >
    {!selectedFlow ? (
      <Empty description="请先选择一个流程" />
    ) : versionLoading ? (
      <div style={{ textAlign: 'center', padding: '40px 0', color: colors.neutral[500] }}>
        加载版本历史...
      </div>
    ) : dataSource.length === 0 ? (
      <Empty description="暂无版本记录" image={Empty.PRESENTED_IMAGE_SIMPLE}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateVersion}>
          创建第一个版本快照
        </Button>
      </Empty>
    ) : (
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 800 }}
        style={{ borderRadius: 8 }}
      />
    )}
  </Card>
);
