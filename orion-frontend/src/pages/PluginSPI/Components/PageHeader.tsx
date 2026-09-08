/**
 * PageHeader - Plugin SPI 页头
 * 抽取自 index.tsx (P2-9 Phase 213)
 */
import { Typography, Button } from 'antd';
import { ReloadOutlined, ExperimentOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ loading, onRefresh }: Props) => (
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
        <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
        Plugin SPI
      </Title>
      <Text type="secondary">插件扩展点管理</Text>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
