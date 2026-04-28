/**
 * SmartRecommend — 智能推荐面板
 *
 * P2-1: usePanelHeight 动态计算最大高度，按屏幕响应式调整
 */

import React, { useState, useEffect } from 'react';
import { Card, Tag, Button, Empty, Space } from 'antd';
import { BellFilled, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { colors } from '@/tokens/colors';

const severityConfig = {
  critical: { color: colors.error[400], bg: colors.error[50], icon: <BellFilled /> },
  warning: { color: colors.warning[500], bg: colors.warning[50], icon: <WarningOutlined /> },
  info: { color: colors.info[500], bg: colors.info[50], icon: <CheckCircleOutlined /> },
};

/** P2-1: 动态计算推荐面板最大高度 */
function usePanelHeight(): number {
  const [maxHeight, setMaxHeight] = useState(240);

  useEffect(() => {
    const update = () => {
      const vh = window.innerHeight;
      // 面板最大占屏幕高度的 30%，不超过 320px
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
  const { recommendations, dismissRecommendation, executeAction } = useChatOpsStore();
  const maxPanelHeight = usePanelHeight();

  if (recommendations.length === 0) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: colors.light.bg.primary,
          borderBottom: `1px solid ${colors.light.border.light}`,
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前无异常"
          style={{ margin: 0, padding: '8px 0' }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxHeight: maxPanelHeight,
        overflowY: 'auto',
        padding: '12px 16px',
        background: colors.warning[50],
        borderBottom: `1px solid ${colors.warning[200]}`,
      }}
    >
      {recommendations.map((rec) => {
        const cfg = severityConfig[rec.severity] ?? severityConfig.info;
        return (
          <Card
            key={rec.id}
            size="small"
            style={{ marginBottom: 8, borderColor: cfg.color + '40' }}
            extra={
              <Button type="text" size="small" onClick={() => dismissRecommendation(rec.id)}>
                ×
              </Button>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <Tag color={cfg.color}>{rec.severity.toUpperCase()}</Tag>
              <strong>{rec.title}</strong>
            </div>
            <p style={{ margin: '4px 0', fontSize: 12, color: colors.light.text.secondary }}>
              {rec.description}
            </p>
            <Space>
              {rec.actions.map((action) => (
                <Button
                  key={action.label}
                  size="small"
                  onClick={() => executeAction(action.command, action.params)}
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
