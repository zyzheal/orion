/**
 * PageHeader.tsx - SLA 页面标题栏
 * 抽取自 index.tsx (P2-9 Phase 238)
 */
import { Typography, Button } from 'antd';
import { ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export function PageHeader({ loading, onRefresh }: Props) {
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
          <SafetyCertificateOutlined
            style={{ marginRight: spacing[3], color: colors.primary[500] }}
          />
          SLA 管理
        </Title>
        <Text type="secondary">定义、追踪和管理服务级别协议，确保服务质量达标</Text>
      </div>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </div>
  );
}
