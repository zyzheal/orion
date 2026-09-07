/**
 * SBOM Detail page header
 * 抽取自 index.tsx (P2-9 Phase 162)
 */
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined, SafetyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export const PageHeader = () => {
  const navigate = useNavigate();
  return (
    <div style={{ marginBottom: spacing.lg }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/sbom')}
        style={{ marginBottom: spacing.md }}
      >
        返回
      </Button>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <SafetyOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
        SBOM 详情
      </Title>
      <Text type="secondary">软件物料清单详细信息</Text>
    </div>
  );
};
