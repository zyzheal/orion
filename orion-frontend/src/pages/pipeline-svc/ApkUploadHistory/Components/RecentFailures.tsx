/**
 * RecentFailures - 最近失败的上传卡
 * 抽取自 index.tsx (P2-9 Phase 215)
 */
import { Card, Button, Space, Typography, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { MARKET_NAMES, type ApkUploadRecord } from '@/api/apk-upload-history';

const { Text } = Typography;

interface Props {
  recentFailures: ApkUploadRecord[];
  onRefresh: () => void;
}

export const RecentFailures = ({ recentFailures, onRefresh }: Props) => {
  if (recentFailures.length === 0) return null;
  return (
    <Card
      title="最近失败的上传"
      style={{ marginBottom: spacing.md }}
      extra={
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {recentFailures.map((record) => (
          <div
            key={record.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 16px',
              background: colors.error[50],
              borderRadius: 4,
            }}
          >
            <Space>
              <Tag color="error">{MARKET_NAMES[record.market]}</Tag>
              <code>{record.packageName}</code>
            </Space>
            <Text type="secondary">{record.error || 'Unknown error'}</Text>
          </div>
        ))}
      </Space>
    </Card>
  );
};
