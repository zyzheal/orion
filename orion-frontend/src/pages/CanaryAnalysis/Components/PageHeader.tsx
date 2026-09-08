import { Button, Space, Typography } from 'antd';
import { ReloadOutlined, SettingOutlined, PlayCircleOutlined, ExperimentOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  loadData: () => void;
  onOpenTrigger: () => void;
  onOpenConfig: () => void;
}

export function PageHeader({ loading, loadData, onOpenTrigger, onOpenConfig }: Props) {
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
          <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          ML 金丝雀分析
        </Title>
        <Text type="secondary">全指标比对与智能决策</Text>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
        <Button icon={<PlayCircleOutlined />} onClick={onOpenTrigger}>
          触发分析
        </Button>
        <Button icon={<SettingOutlined />} onClick={onOpenConfig}>
          配置管理
        </Button>
      </Space>
    </div>
  );
}
