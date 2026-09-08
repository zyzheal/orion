/**
 * PageHeader - Artifact 版本管理页头
 * 抽取自 index.tsx (P2-9 Phase 210)
 */
import { Typography, Button } from 'antd';
import {
  ArrowLeftOutlined,
  TagOutlined,
  BranchesOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  total: number;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
}

export const PageHeader = ({ total, loading, onBack, onRefresh }: Props) => (
  <div
    style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}
  >
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
      返回
    </Button>
    <div style={{ flex: 1 }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <TagOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        <BranchesOutlined /> Artifact 版本管理
      </Title>
      <Text type="secondary">共 {total} 个版本</Text>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
