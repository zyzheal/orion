/**
 * PageHeader - AI Gateway 页头
 * 抽取自 index.tsx (P2-9 Phase 219)
 */
import { Button, Space, Typography, Tooltip } from 'antd';
import { ReloadOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons';
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
      marginBottom: spacing.lg,
      gridColumn: '1 / -1',
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <RobotOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        AI 网关管理
      </Title>
      <Text type="secondary">AI 模型路由、降级处理、规则引擎监控</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Tooltip title="AI 网关配置功能开发中">
        <Button icon={<SettingOutlined />} disabled>
          配置
        </Button>
      </Tooltip>
    </Space>
  </div>
);
