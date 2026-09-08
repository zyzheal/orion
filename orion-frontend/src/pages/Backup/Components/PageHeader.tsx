import { Typography, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onLoad: () => void;
  onOpenCreate: () => void;
}

export function PageHeader({ loading, onLoad, onOpenCreate }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing[6],
      }}
    >
      <div>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <SaveOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          Backup Management
        </Title>
        <Text type="secondary">数据备份与恢复</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={onLoad} loading={loading}>
          刷新
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onOpenCreate}>
          创建备份
        </Button>
      </Space>
    </div>
  );
}
