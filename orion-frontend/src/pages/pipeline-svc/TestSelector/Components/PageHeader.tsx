/**
 * TestSelector PageHeader
 * 抽取自 index.tsx (P2-9 Phase 171)
 */
import { Button, Space, Typography } from 'antd';
import { ExperimentOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  selectedCount: number;
  onRunSelected: () => void;
}

export const PageHeader = ({ selectedCount, onRunSelected }: PageHeaderProps) => (
  <div
    style={{
      marginBottom: spacing[6],
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }}
  >
    <div>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        Test Selector
      </Title>
      <Text type="secondary">测试用例选择与管理</Text>
    </div>
    <Space>
      <Button
        type="primary"
        icon={<PlayCircleOutlined />}
        onClick={onRunSelected}
        disabled={selectedCount === 0}
      >
        Run Selected ({selectedCount})
      </Button>
    </Space>
  </div>
);
