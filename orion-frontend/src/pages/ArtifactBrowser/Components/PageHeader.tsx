/**
 * PageHeader.tsx - ArtifactBrowser 页头
 * 抽取自 index.tsx (P2-9 Phase 222)
 */
import { Button, Typography } from 'antd';
import { FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

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
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FolderOpenOutlined
          style={{ marginRight: spacing[3], color: colors.primary[500] }}
        />
        制品版本浏览器
      </Title>
      <Text type="secondary">查看制品版本追溯链、对比版本差异、触发部署</Text>
    </div>
    <Button icon={<ReloadOutlined spin={loading} />} onClick={onRefresh}>
      刷新
    </Button>
  </div>
);
