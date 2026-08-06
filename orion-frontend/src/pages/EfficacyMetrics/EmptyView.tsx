import React from 'react';
import { Card, Typography, Button } from 'antd';
import { BarChartOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

interface EmptyViewProps {
  title: string;
  description: string;
  redirect?: string;
}

/** Phase 2 占位页 */
const EmptyView: React.FC<EmptyViewProps> = ({ title, description, redirect }) => (
  <div style={{ padding: spacing.lg, textAlign: 'center' }}>
    <Card style={{ width: 480, margin: '80px auto' }}>
      <BarChartOutlined style={{ fontSize: 56, color: colors.primary[500], marginBottom: spacing.md, display: 'block' }} />
      <h3>{title}</h3>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        {description}
      </Text>
      {redirect && (
        <Button type="primary" href={redirect} target="_self">
          <InfoCircleOutlined style={{ marginRight: spacing[2] }} />
          返回总览
        </Button>
      )}
    </Card>
  </div>
);

export default EmptyView;
