/**
 * EventRegistry page header
 * 抽取自 index.tsx (P2-9 Phase 166)
 */
import { Button, Space, Typography } from 'antd';
import { ExperimentOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens/spacing';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
  onTestMatch: () => void;
}

export const PageHeader = ({ loading, onRefresh, onTestMatch }: PageHeaderProps) => (
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
        Event Registry
      </Title>
      <Text type="secondary">事件触发器注册表 - 管理事件类型、订阅和触发规则</Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button type="primary" icon={<ExperimentOutlined />} onClick={onTestMatch}>
        测试匹配
      </Button>
    </Space>
  </div>
);
