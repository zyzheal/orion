/**
 * SubAppCardView.tsx - 单个子系统卡片
 * 抽取自 index.tsx (P2-9 Phase 225)
 */
import React from 'react';
import { Button, Card, Tag, Typography } from 'antd';

const { Paragraph, Title } = Typography;
import { ArrowRightOutlined } from '@ant-design/icons';
import { spacing, themeVars } from '@/tokens';
import type { SubAppCard } from '../constants';

interface Props {
  app: SubAppCard;
  onNavigate: (path: string) => void;
}

export const SubAppCardView: React.FC<Props> = ({ app, onNavigate }) => (
  <Card
    hoverable
    style={{
      height: '100%',
      minHeight: 280,
      borderRadius: 12,
      border: `1px solid ${themeVars.borderLight}`,
      transition: 'all 0.3s',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}
    onClick={() => onNavigate(app.path)}
    bodyStyle={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}
  >
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 12,
        background: `${app.color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
      }}
    >
      <div style={{ fontSize: spacing[8], color: app.color }}>{app.icon}</div>
    </div>

    <Title level={4} style={{ marginBottom: spacing.sm }}>
      {app.name}
    </Title>

    {app.tags.length > 0 && (
      <div style={{ marginBottom: spacing[3] }}>
        {app.tags.map((tag) => (
          <Tag key={tag} color={app.color} style={{ marginRight: 4 }}>
            {tag}
          </Tag>
        ))}
      </div>
    )}

    <Paragraph
      type="secondary"
      style={{
        flex: 1,
        fontSize: spacing[4],
        lineHeight: 1.6,
        marginBottom: spacing.lg,
      }}
    >
      {app.description}
    </Paragraph>

    <Button
      type="primary"
      icon={<ArrowRightOutlined />}
      style={{
        background: app.color,
        borderColor: app.color,
        alignSelf: 'flex-start',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(app.path);
      }}
    >
      进入系统
    </Button>
  </Card>
);
