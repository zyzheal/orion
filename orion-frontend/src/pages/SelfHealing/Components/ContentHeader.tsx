import { Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import { pageTitleMap } from './constants';

const { Title, Text } = Typography;

interface Props {
  selectedKey: string;
}

export function ContentHeader({ selectedKey }: Props) {
  const pageInfo = pageTitleMap[selectedKey] || { icon: null, title: '', subtitle: '' };

  if (!pageInfo.title) return null;

  return (
    <div style={{ marginBottom: spacing.md }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        {pageInfo.icon && (
          <span style={{ marginRight: spacing[3], color: colors.primary[500] }}>
            {pageInfo.icon}
          </span>
        )}
        {pageInfo.title}
      </Title>
      {pageInfo.subtitle && <Text type="secondary">{pageInfo.subtitle}</Text>}
    </div>
  );
}
