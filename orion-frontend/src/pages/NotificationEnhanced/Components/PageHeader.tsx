import { Button, Typography, Tooltip } from 'antd';
import { BellOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          高级通知管理
        </Title>
        <Text type="secondary">管理通知策略、集成渠道、用户订阅、发送历史、公告与数据矩阵</Text>
      </div>
      <Tooltip title="刷新所有数据">
        <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
          刷新
        </Button>
      </Tooltip>
    </div>
  );
}
