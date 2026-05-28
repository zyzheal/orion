/**
 * CardPanel Component
 * - Reusable card container with header, body, and actions
 * - Used throughout the application for consistent card layouts
 */
import React from 'react';
import { Card } from 'antd';
import { colors } from '@/tokens';

// Module-level flag to ensure the deprecation warning is printed only once
// across the entire lifetime of the application, regardless of how many
// CardPanel instances are mounted.
let cardPanelDeprecatedWarned = false;
function warnDeprecation() {
  if (import.meta.env.DEV && !cardPanelDeprecatedWarned) {
    cardPanelDeprecatedWarned = true;
    console.warn(
      '[Orion] CardPanel is deprecated. Use Ant Design <Card> with ConfigProvider theme and className="orion-card" instead.'
    );
  }
}

// ============================================================================
// Types
// ============================================================================

export interface CardPanelProps {
  /** Card title */
  title?: React.ReactNode;
  /** Card content */
  children: React.ReactNode;
  /** Extra content in the header (right side) */
  extra?: React.ReactNode;
  /** Card actions (bottom right) */
  actions?: React.ReactNode[];
  /** Loading state */
  loading?: boolean;
  /** Whether the card has a border */
  bordered?: boolean;
  /** Whether the card is hoverable */
  hoverable?: boolean;
  /** Card size */
  size?: 'small' | 'default';
  /** Custom header style */
  headerStyle?: React.CSSProperties;
  /** Custom body style */
  bodyStyle?: React.CSSProperties;
  /** Whether to collapse content overflow */
  collapsible?: boolean;
  /** Collapsed state (controlled) */
  collapsed?: boolean;
  /** Collapse change handler */
  onCollapse?: (collapsed: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

function CardPanel({
  title,
  children,
  extra,
  actions,
  loading = false,
  bordered = true,
  hoverable = false,
  size = 'default',
  headerStyle,
  bodyStyle,
  collapsible = false,
  collapsed: controlledCollapsed,
  onCollapse,
}: CardPanelProps) {
  // Emit deprecation warning once on first mount
  React.useEffect(() => {
    warnDeprecation();
  }, []);

  const [internalCollapsed, setInternalCollapsed] = React.useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleCollapse = () => {
    const newCollapsed = !isCollapsed;
    if (onCollapse) {
      onCollapse(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
  };

  const headerExtra = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {extra}
      {collapsible && (
        <span
          onClick={handleCollapse}
          style={{ cursor: 'pointer', fontSize: 16, color: colors.neutral[500] }}
          role="button"
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '+' : '-'}
        </span>
      )}
    </div>
  );

  return (
    <Card
      title={title}
      extra={headerExtra}
      actions={actions}
      loading={loading}
      bordered={bordered}
      hoverable={hoverable}
      size={size}
      style={{
        borderRadius: 'var(--radius-lg, 8px)',
        boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.03))',
        overflow: 'hidden',
      }}
      styles={{
        header: {
          borderBottom: '1px solid var(--border-light, colors.neutral[200])',
          ...headerStyle,
        },
        body: {
          padding: 'var(--spacing-lg, 24px)',
          ...bodyStyle,
        },
      }}
      className="orion-card-panel orion-card"
      data-testid="orion-card-panel"
    >
      {!isCollapsed && children}
    </Card>
  );
}

export default CardPanel;
