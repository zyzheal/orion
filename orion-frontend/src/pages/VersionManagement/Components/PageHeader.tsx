import { Typography } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

export function PageHeader() {
  return (
    <>
      <Title
        level={2}
        style={{
          marginBottom: 8,
          fontWeight: 600,
          color: colors.neutral[900],
        }}
      >
        <CloudUploadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        版本管理
      </Title>
      <Text
        type="secondary"
        style={{
          marginBottom: spacing.md,
          display: 'block',
          fontSize: 14,
          color: colors.neutral[500],
        }}
      >
        管理 Pipeline、制品和部署版本，支持版本对比、回滚和基线标记
      </Text>
    </>
  );
}
