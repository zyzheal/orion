import { Typography, Button, Space, Tag, Popconfirm } from 'antd';
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  alertsCount: number;
  severityCounts: { critical: number; warning: number; info: number };
  selectedRowKeysCount: number;
  batchableCount: number;
  loading: boolean;
  onBatchAcknowledge: () => void;
  onBatchResolve: () => void;
  onRefresh: () => void;
}

export function PageHeader({
  alertsCount,
  severityCounts,
  selectedRowKeysCount,
  batchableCount,
  loading,
  onBatchAcknowledge,
  onBatchResolve,
  onRefresh,
}: Props) {
  return (
    <div
      style={
        {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        } as React.CSSProperties
      }
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          监控告警
        </Title>
        <Text type="secondary">共 {alertsCount} 条告警记录</Text>
        {(severityCounts.critical > 0 || severityCounts.warning > 0) && (
          <div style={{ marginTop: spacing.sm }}>
            <Space size={12}>
              {severityCounts.critical > 0 && (
                <Tag color="red" style={{ fontWeight: 600 }}>
                  {severityCounts.critical} 个严重告警
                </Tag>
              )}
              {severityCounts.warning > 0 && (
                <Tag color="orange">{severityCounts.warning} 个警告</Tag>
              )}
              {severityCounts.info > 0 && (
                <Tag color="blue">{severityCounts.info} 个提示</Tag>
              )}
            </Space>
          </div>
        )}
      </div>
      <Space>
        {selectedRowKeysCount > 0 && (
          <>
            <Popconfirm
              title={`确认 ${selectedRowKeysCount} 条告警?`}
              onConfirm={onBatchAcknowledge}
            >
              <Button icon={<CheckOutlined />} type="primary" ghost>
                批量确认 ({selectedRowKeysCount})
              </Button>
            </Popconfirm>
            <Popconfirm title={`解决 ${batchableCount} 条告警?`} onConfirm={onBatchResolve}>
              <Button danger icon={<CloseOutlined />}>
                批量解决
              </Button>
            </Popconfirm>
          </>
        )}
        <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
          刷新
        </Button>
      </Space>
    </div>
  );
}
