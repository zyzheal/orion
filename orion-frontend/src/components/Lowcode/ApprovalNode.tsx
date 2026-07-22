/**
 * ApprovalNode - 审批节点组件
 * 低代码平台工作流中的审批节点可视化
 */
import React, { useMemo } from 'react';
import { Badge, Tooltip, Space, Tag, Typography } from 'antd';
import {
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import { componentRadius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import { spacing } from '@/tokens/spacing';
import {
  ApprovalNodeConfig,
  ApprovalNodeStatus,
  approvalModeShortLabels,
} from './types';

const { Text } = Typography;

interface ApprovalNodeProps {
  config: ApprovalNodeConfig;
  status?: ApprovalNodeStatus;
  selected?: boolean;
  onClick?: () => void;
}

// 状态颜色映射
const statusColors: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  pending: {
    bg: colors.warning[50],
    border: colors.warning[500],
    text: colors.warning[700],
    icon: <ClockCircleOutlined />,
  },
  approved: {
    bg: colors.success[50],
    border: colors.success[500],
    text: colors.success[700],
    icon: <CheckCircleOutlined />,
  },
  rejected: {
    bg: colors.error[50],
    border: colors.error[500],
    text: colors.error[700],
    icon: <CloseCircleOutlined />,
  },
  cancelled: {
    bg: colors.neutral[100],
    border: colors.neutral[400],
    text: colors.neutral[600],
    icon: <CloseCircleOutlined />,
  },
};

/**
 * 格式化时长
 */
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}分钟`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时`;
  return `${Math.floor(minutes / 1440)}天`;
};

/**
 * ApprovalNode - 审批节点组件
 * 用于在工作流画布中展示审批节点
 */
const ApprovalNode: React.FC<ApprovalNodeProps> = ({
  config,
  status,
  selected = false,
  onClick,
}) => {
  const currentStatus = status?.status || 'pending';
  const style = statusColors[currentStatus] || statusColors.pending;

  // 审批人显示逻辑
  const approverDisplay = useMemo(() => {
    const { approvers } = config;

    if (approvers.length === 0) {
      return { text: '未配置审批人', type: 'warning' };
    }

    if (approvers.length === 1) {
      const approver = approvers[0];
      return {
        text: approver.name,
        type: approver.type === 'role' ? 'processing' : 'default',
      };
    }

    // 显示多人情况
    const userCount = approvers.filter(a => a.type === 'user').length;
    const roleCount = approvers.filter(a => a.type === 'role').length;

    const parts: string[] = [];
    if (userCount > 0) parts.push(`${userCount}人`);
    if (roleCount > 0) parts.push(`${roleCount}角色`);

    return { text: parts.join('+'), type: 'processing' };
  }, [config.approvers, config.mode]);

  // 审批进度
  const progressInfo = useMemo(() => {
    if (!status) return null;

    const { completedApprovers, currentApprovers } = status;
    const total = config.approvers.length;

    if (total === 0) return null;

    const completed = completedApprovers.length;
    const current = currentApprovers.length;

    return { completed, current, total };
  }, [status, config.approvers]);

  return (
    <Tooltip
      title={
        <div style={{ padding: 4 }}>
          <div style={{ fontWeight: 600, marginBottom: spacing.sm }}>{config.name}</div>
          {config.description && (
            <div style={{ color: colors.neutral[500], marginBottom: spacing.sm, fontSize: 12 }}>
              {config.description}
            </div>
          )}
          <Space direction="vertical" size={4} style={{ fontSize: 12 }}>
            <div>
              <TeamOutlined /> 审批模式：{approvalModeShortLabels[config.mode]}
            </div>
            <div>
              <UserOutlined /> 审批人：{approverDisplay.text}
            </div>
            {config.timeout.enabled && (
              <div>
                <ClockCircleOutlined /> 超时：{formatDuration(config.timeout.duration)}
              </div>
            )}
            {progressInfo && (
              <div>
                进度：{progressInfo.completed}/{progressInfo.total}
              </div>
            )}
          </Space>
        </div>
      }
      placement="top"
      mouseEnterDelay={0.3}
    >
      <div
        onClick={onClick}
        style={{
          // 容器样式
          width: 180,
          padding: spacing.md,
          borderRadius: componentRadius.card,
          background: style.bg,
          border: `2px solid ${selected ? colors.primary[500] : style.border}`,
          boxShadow: selected
            ? shadows.card + `, 0 0 0 2px ${colors.primary[100]}`
            : shadows.card,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
        onMouseEnter={(e) => {
          if (!selected) {
            e.currentTarget.style.borderColor = colors.primary[400];
            e.currentTarget.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          if (!selected) {
            e.currentTarget.style.borderColor = style.border;
            e.currentTarget.style.transform = 'translateY(0)';
          }
        }}
      >
        {/* 节点类型标识 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            borderRadius: `${componentRadius.card} 0 0 ${componentRadius.card}`,
            background: style.border,
          }}
        />

        {/* 头部：状态 + 节点类型 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.sm,
          }}
        >
          <Space size={4}>
            <Text style={{ fontSize: 12, color: colors.primary[600] }}>
              审批节点
            </Text>
          </Space>
          <span style={{ color: style.text, fontSize: 14 }}>{style.icon}</span>
        </div>

        {/* 节点名称 */}
        <Text
          strong
          style={{
            fontSize: 14,
            display: 'block',
            marginBottom: spacing.xs,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {config.name}
        </Text>

        {/* 审批模式标签 */}
        <Tag
          color={config.mode === 'all' ? 'blue' : config.mode === 'any' ? 'green' : 'orange'}
          style={{ marginBottom: spacing.sm, fontSize: 11 }}
        >
          {approvalModeShortLabels[config.mode]}
        </Tag>

        {/* 审批人信息 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          <UserOutlined style={{ fontSize: 12, color: colors.neutral[500] }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {approverDisplay.text}
          </Text>
        </div>

        {/* 超时信息 */}
        {config.timeout.enabled && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing.xs,
            }}
          >
            <ClockCircleOutlined style={{ fontSize: 12, color: colors.neutral[500] }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              超时{config.timeout.action === 'remind' ? '提醒' : '自动' + (config.timeout.action === 'auto_approve' ? '通过' : config.timeout.action === 'auto_reject' ? '拒绝' : '转交')}
            </Text>
          </div>
        )}

        {/* 进度条（当有状态时） */}
        {progressInfo && progressInfo.total > 0 && (
          <div
            style={{
              marginTop: spacing.sm,
              height: 4,
              background: colors.neutral[200],
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(progressInfo.completed / progressInfo.total) * 100}%`,
                background:
                  currentStatus === 'approved'
                    ? colors.success[500]
                    : currentStatus === 'rejected'
                      ? colors.error[500]
                      : colors.primary[500],
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        )}
      </div>
    </Tooltip>
  );
};

export default ApprovalNode;

// 导出便捷组件：迷你审批节点（用于列表等场景）
export const ApprovalNodeMini: React.FC<{
  config: ApprovalNodeConfig;
  compact?: boolean;
}> = ({ config, compact = false }) => {
  const approverCount = config.approvers.length;

  return (
    <Space size={4}>
      <TeamOutlined style={{ color: colors.primary[500] }} />
      <Text strong style={{ fontSize: compact ? 12 : 14 }}>
        {config.name}
      </Text>
      <Tag
        color={config.mode === 'all' ? 'blue' : config.mode === 'any' ? 'green' : 'orange'}
        style={{ fontSize: 10, padding: '0 4px' }}
      >
        {approvalModeShortLabels[config.mode]}
      </Tag>
      {approverCount > 0 && (
        <Badge
          count={approverCount}
          style={{
            backgroundColor: colors.primary[100],
            color: colors.primary[700],
            fontSize: 10,
          }}
        />
      )}
    </Space>
  );
};