/**
 * StatusBadge Component
 * - Color-coded status badges for pipeline/deployment states
 * - Running/Pending/Success/Failed/Warning/Cancelled states
 * - Animated indicator for running state
 */
import React, { useMemo } from 'react';
import { colors } from '@/tokens';

// ============================================================================
// Types
// ============================================================================

export type StatusType =
  | 'running'
  | 'pending'
  | 'success'
  | 'failed'
  | 'warning'
  | 'cancelled'
  | 'unknown';

export interface StatusBadgeProps {
  /** Status value */
  status: StatusType;
  /** Custom label (defaults to status name) */
  label?: string;
  /** Show the pulsing dot indicator */
  showDot?: boolean;
  /** Size of the badge */
  size?: 'small' | 'medium' | 'large';
  /** Variant style */
  variant?: 'filled' | 'outlined' | 'subtle';
}

// ============================================================================
// Config
// ============================================================================

interface StatusConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  animated: boolean;
}

const statusConfigMap: Record<StatusType, StatusConfig> = {
  running: {
    color: colors.primary[500],
    bgColor: colors.primary[50],
    borderColor: colors.primary[200],
    label: 'Running',
    animated: true,
  },
  pending: {
    color: colors.neutral[500],
    bgColor: colors.neutral[50],
    borderColor: colors.neutral[300],
    label: 'Pending',
    animated: false,
  },
  success: {
    color: colors.success[600],
    bgColor: colors.success[50],
    borderColor: colors.success[200],
    label: 'Success',
    animated: false,
  },
  failed: {
    color: colors.error[600],
    bgColor: colors.error[50],
    borderColor: colors.error[200],
    label: 'Failed',
    animated: false,
  },
  warning: {
    color: colors.warning[600],
    bgColor: colors.warning[50],
    borderColor: colors.warning[200],
    label: 'Warning',
    animated: false,
  },
  cancelled: {
    color: colors.neutral[500],
    bgColor: colors.neutral[50],
    borderColor: colors.neutral[300],
    label: 'Cancelled',
    animated: false,
  },
  unknown: {
    color: colors.neutral[500],
    bgColor: colors.neutral[50],
    borderColor: colors.neutral[300],
    label: 'Unknown',
    animated: false,
  },
};

const sizeMap = {
  small: { fontSize: 11, padding: '2px 8px', dotSize: 6 },
  medium: { fontSize: 12, padding: '4px 12px', dotSize: 8 },
  large: { fontSize: 14, padding: '6px 16px', dotSize: 10 },
};

// ============================================================================
// Styles (injected once)
// ============================================================================

const pulseKeyframes = `
  @keyframes status-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
`;

let styleInjected = false;
function injectStyles() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
  styleInjected = true;
}

// ============================================================================
// Component
// ============================================================================

function StatusBadge({
  status,
  label,
  showDot = true,
  size = 'medium',
  variant = 'filled',
}: StatusBadgeProps) {
  injectStyles();

  const config = statusConfigMap[status] || statusConfigMap.unknown;
  const sizeConfig = sizeMap[size];
  const displayLabel = label || config.label;

  const style = useMemo(() => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: sizeConfig.fontSize,
      fontWeight: 500,
      padding: sizeConfig.padding,
      borderRadius: 9999,
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
      transition: 'all 0.2s ease',
    };

    switch (variant) {
      case 'filled':
        return {
          ...base,
          color: config.color,
          backgroundColor: config.bgColor,
          border: `1px solid ${config.borderColor}`,
        };
      case 'outlined':
        return {
          ...base,
          color: config.color,
          backgroundColor: 'transparent',
          border: `1.5px solid ${config.color}`,
        };
      case 'subtle':
        return {
          ...base,
          color: config.color,
          backgroundColor: config.bgColor,
          border: '1px solid transparent',
        };
      default:
        return base;
    }
  }, [variant, config, sizeConfig]);

  const dotStyle = useMemo(
    (): React.CSSProperties => ({
      width: sizeConfig.dotSize,
      height: sizeConfig.dotSize,
      borderRadius: '50%',
      backgroundColor: config.color,
      flexShrink: 0,
      animation: config.animated ? 'status-pulse 1.5s ease-in-out infinite' : 'none',
    }),
    [config, sizeConfig]
  );

  return (
    <span
      className={`orion-status-badge orion-status-${status}`}
      style={style}
      data-testid="status-badge"
      data-status={status}
    >
      {showDot && <span style={dotStyle} data-testid="status-dot" />}
      {displayLabel}
    </span>
  );
}

export default StatusBadge;
