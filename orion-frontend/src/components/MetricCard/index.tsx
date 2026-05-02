/**
 * MetricCard Component
 * - KPI card display with value, label, trend indicator
 * - Comparison with previous period
 * - Used for dashboard KPI displays
 */
import React, { useMemo } from 'react';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';

// ============================================================================
// Types
// ============================================================================

export type TrendDirection = 'up' | 'down' | 'stable';

export interface MetricCardProps {
  /** Metric title */
  title: string;
  /** Current metric value */
  value: number | string;
  /** Unit label (e.g., '%', 'ms', 'GB') */
  unit?: string;
  /** Trend direction */
  trend?: TrendDirection;
  /** Previous period value for comparison */
  previousValue?: number | string;
  /** Trend percentage (auto-calculated if not provided) */
  trendPercent?: number;
  /** Icon or visual element */
  icon?: React.ReactNode;
  /** Tooltip content for title */
  tooltip?: string | React.ReactNode;
  /** Additional footer content */
  footer?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Card size */
  size?: 'small' | 'medium' | 'large';
  /** Color theme override */
  color?: string;
  /** Click handler */
  onClick?: () => void;
}

// ============================================================================
// Helper: Calculate trend percentage
// ============================================================================

function calculateTrendPercent(current: number | string, previous: number | string): number {
  const curr = typeof current === 'string' ? parseFloat(current) : current;
  const prev = typeof previous === 'string' ? parseFloat(previous) : previous;

  if (isNaN(curr) || isNaN(prev) || prev === 0) return 0;
  return Math.round(((curr - prev) / prev) * 100);
}

// ============================================================================
// Helper: Format large numbers
// ============================================================================

function formatValue(value: number | string): string {
  if (typeof value === 'string') return value;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}

// ============================================================================
// Component
// ============================================================================

function MetricCard({
  title,
  value,
  unit,
  trend,
  previousValue,
  trendPercent,
  icon,
  tooltip,
  footer,
  loading = false,
  size = 'medium',
  color,
  onClick,
}: MetricCardProps) {
  // Calculate trend
  const computedTrendPercent = useMemo(() => {
    if (trendPercent !== undefined) return trendPercent;
    if (previousValue !== undefined) return calculateTrendPercent(value, previousValue);
    return undefined;
  }, [trendPercent, value, previousValue]);

  // Determine trend direction
  const computedTrend = useMemo((): TrendDirection => {
    if (trend) return trend;
    if (computedTrendPercent === undefined) return 'stable';
    if (computedTrendPercent > 0) return 'up';
    if (computedTrendPercent < 0) return 'down';
    return 'stable';
  }, [trend, computedTrendPercent]);

  // Size configs
  const sizeConfig = useMemo(() => {
    switch (size) {
      case 'small':
        return { titleSize: 12, valueSize: 20, padding: 16 };
      case 'large':
        return { titleSize: 16, valueSize: 36, padding: 24 };
      default:
        return { titleSize: 14, valueSize: 28, padding: 20 };
    }
  }, [size]);

  // Trend color
  const trendColor = useMemo(() => {
    if (color) return color;
    switch (computedTrend) {
      case 'up':
        return '#52c41a';
      case 'down':
        return '#f5222d';
      default:
        return '#8c8c8c';
    }
  }, [computedTrend, color]);

  // Trend icon
  const trendIcon = useMemo(() => {
    switch (computedTrend) {
      case 'up':
        return <ArrowUpOutlined style={{ color: trendColor }} />;
      case 'down':
        return <ArrowDownOutlined style={{ color: trendColor }} />;
      default:
        return <MinusOutlined style={{ color: trendColor }} />;
    }
  }, [computedTrend, trendColor]);

  return (
    <div
      className="orion-metric-card"
      data-testid="metric-card"
      onClick={onClick}
      style={{
        background: 'var(--bg-elevated, #ffffff)',
        borderRadius: 'var(--radius-lg, 8px)',
        padding: sizeConfig.padding,
        border: '1px solid var(--border-light, #f0f0f0)',
        boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.03))',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.03))';
          e.currentTarget.style.transform = 'none';
        }
      }}
    >
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '3px solid #f0f0f0',
              borderTopColor: '#1890ff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: sizeConfig.titleSize,
            color: 'var(--text-secondary, #595959)',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          data-testid="metric-title"
        >
          {title}
          {tooltip && (
            <Tooltip title={tooltip} placement="top">
              <InfoCircleOutlined style={{ fontSize: 12, color: 'var(--text-tertiary, #8c8c8c)', cursor: 'help' }} />
            </Tooltip>
          )}
        </span>
        {icon && <span style={{ color: color || '#1890ff' }}>{icon}</span>}
      </div>

      {/* Value row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: sizeConfig.valueSize,
            fontWeight: 700,
            color: 'var(--text-primary, #1f1f1f)',
            lineHeight: 1.2,
          }}
          data-testid="metric-value"
        >
          {formatValue(value)}
        </span>
        {unit && (
          <span
            style={{
              fontSize: sizeConfig.titleSize,
              color: 'var(--text-tertiary, #8c8c8c)',
              fontWeight: 400,
            }}
            data-testid="metric-unit"
          >
            {unit}
          </span>
        )}
      </div>

      {/* Trend row */}
      {computedTrendPercent !== undefined && previousValue !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: trendColor,
          }}
          data-testid="metric-trend"
        >
          {trendIcon}
          <span>
            {computedTrendPercent > 0 ? '+' : ''}
            {computedTrendPercent}% vs {formatValue(previousValue)}
          </span>
        </div>
      )}

      {/* Footer */}
      {footer && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border-light, #f0f0f0)',
            fontSize: 12,
            color: 'var(--text-tertiary, #8c8c8c)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
