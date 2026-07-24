/**
 * SmartRecommend — 智能推荐面板（轻量提示条版）
 * - 仅展示关联当前当前用户且未被处理的推荐
 * - 轻量单行提示条样式，融入欢迎区域，不切割面板
 * - 点击 dismiss 后永久消失（不再推送）
 */

import React from 'react';
import { Button, Typography } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Text } = Typography;

const severityDot: Record<string, string> = {
  critical: colors.error[500],
  warning: colors.warning[500],
  info: colors.primary[500],
};

export const SmartRecommend: React.FC = () => {
  const { recommendations, dismissRecommendation, executeAction } = useChatOpsStore();
  const userId = useAuthStore((s) => s.user?.id);

  // 过滤：只保留关联当前用户或无 assignee 的推荐
  const visibleRecs = React.useMemo(() => {
    return recommendations.filter((r) => {
      // 已处理的不展示
      if (r.status === 'dismissed' || r.status === 'resolved') return false;
      // 有 assignee 但不是当前用户的不展示
      const assignee = r.assignee;
      if (assignee && assignee !== userId) return false;
      return true;
    });
  }, [recommendations, userId]);

  if (visibleRecs.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: spacing.md,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        }}
      >
        <Text type="secondary" style={{ fontSize: 11 }}>
          智能推荐
        </Text>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibleRecs.map((rec) => (
          <div
            key={rec.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: '8px 10px',
              background: colors.light.bg.primary,
              borderRadius: 8,
              border: `1px solid ${colors.light.border.light}`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = colors.primary[300];
              (e.currentTarget as HTMLElement).style.background = colors.primary[50];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = colors.light.border.light;
              (e.currentTarget as HTMLElement).style.background = colors.light.bg.primary;
            }}
          >
            {/* Severity dot */}
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: severityDot[rec.severity] ?? colors.neutral[400],
                flexShrink: 0,
              }}
            />
            {/* Title (truncated) */}
            <Text
              ellipsis={{ tooltip: rec.title }}
              style={{ flex: 1, fontSize: 12, fontWeight: 500 }}
            >
              {rec.title}
            </Text>
            {/* Quick action link */}
            {rec.actions.length > 0 && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 11, height: 'auto', color: colors.primary[500] }}
                onClick={() => executeAction(rec.actions[0].command || '', {})}
              >
                去处理
              </Button>
            )}
            {/* Dismiss */}
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined style={{ fontSize: 10 }} />}
              style={{ padding: 0, color: colors.light.text.tertiary, height: 'auto' }}
              onClick={() => dismissRecommendation(rec.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
