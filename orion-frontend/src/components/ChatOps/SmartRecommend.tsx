/**
 * SmartRecommend — 智能推荐面板
 */

import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Empty, Space, Typography } from 'antd';
import { BellFilled, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';
import { useActionHandler } from './useActionHandler';
import { getActionIcon } from './actionIcons';

const { Text } = Typography;

const severityConfig = {
  critical: { color: colors.error[400], bg: colors.error[50], icon: <BellFilled /> },
  warning: { color: colors.warning[500], bg: colors.warning[50], icon: <WarningOutlined /> },
  info: { color: colors.info[500], bg: colors.info[50], icon: <CheckCircleOutlined /> },
};

/** 动态计算推荐面板最大高度 */
function usePanelHeight(): number {
  const [maxHeight, setMaxHeight] = useState(240);

  useEffect(() => {
    const update = () => {
      const vh = window.innerHeight;
      const limit = Math.floor(vh * 0.3);
      setMaxHeight(Math.min(limit, 320));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return maxHeight;
}

export const SmartRecommend: React.FC = () => {
  const { recommendations, dismissRecommendation } = useChatOpsStore();
  const handleAction = useActionHandler();
  const maxPanelHeight = usePanelHeight();

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        maxHeight: maxPanelHeight,
        overflowY: 'auto',
        padding: '12px 16px',
        background: colors.light.bg.secondary,
        flexShrink: 0,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          智能推荐
        </Text>
      </div>
      {recommendations.map((rec) => {
        const cfg = severityConfig[rec.severity] ?? severityConfig.info;
        return (
          <Card
            key={rec.id}
            size="small"
            style={{
              marginBottom: 8,
              borderColor: cfg.color + '40',
              borderRadius: 8,
            }}
            extra={
              <Button
                type="text"
                size="small"
                style={{ padding: '0 4px', color: colors.light.text.tertiary }}
                onClick={() => dismissRecommendation(rec.id)}
              >
                ×
              </Button>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: cfg.color, fontSize: 14 }}>{cfg.icon}</span>
              <Tag color={cfg.color} style={{ margin: 0, fontSize: 10, padding: '0 6px' }}>
                {rec.severity.toUpperCase()}
              </Tag>
              <Text strong style={{ fontSize: 13 }}>{rec.title}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              {rec.description}
            </Text>
            <Space size="small">
              {rec.actions.map((action) => (
                <Button
                  key={action.label}
                  size="small"
                  type="primary"
                  ghost
                  onClick={() => handleAction(action)}
                  style={{ fontSize: 12, height: 24, borderRadius: 4 }}
                >
                  {action.label}
                </Button>
              ))}
            </Space>
          </Card>
        );
      })}
    </div>
  );
};
