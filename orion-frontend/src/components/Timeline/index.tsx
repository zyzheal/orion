/**
 * Timeline Component
 * - Chronological event display
 * - Status icons per event
 * - Used for pipeline execution history, deployment logs, etc.
 */
import React from 'react';
import { Timeline as AntTimeline } from 'antd';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';
import dayjs from 'dayjs';

// ============================================================================
// Types
// ============================================================================

export interface TimelineEvent {
  /** Unique event ID */
  id?: string | number;
  /** Event timestamp (ISO string or Date) */
  time: string | Date;
  /** Event title */
  title: string;
  /** Optional description */
  description?: string;
  /** Event status (affects icon color) */
  status?: StatusType;
  /** Custom color override */
  color?: string;
  /** Custom icon */
  icon?: React.ReactNode;
}

export interface TimelineProps {
  /** Events to display */
  events: TimelineEvent[];
  /** Whether to show in reverse order (newest first) */
  reverse?: boolean;
  /** Maximum number of events to show */
  maxItems?: number;
  /** Show "Show More" button when truncated */
  showMore?: boolean;
  /** Handler for "Show More" click */
  onShowMore?: () => void;
  /** Pending event at the top */
  pending?: boolean;
  /** Pending event description */
  pendingText?: string;
  /** Alternate left/right layout */
  mode?: 'left' | 'alternate' | 'right';
}

// ============================================================================
// Helper: Format time
// ============================================================================

function formatTime(time: string | Date): string {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
}

// ============================================================================
// Helper: Get color from status
// ============================================================================

function getStatusColor(status?: StatusType): string {
  switch (status) {
    case 'success':
      return '#52c41a';
    case 'failed':
      return '#f5222d';
    case 'warning':
      return '#faad14';
    case 'running':
      return '#1890ff';
    case 'pending':
      return '#d9d9d9';
    case 'cancelled':
      return '#8c8c8c';
    default:
      return '#d9d9d9';
  }
}

// ============================================================================
// Component
// ============================================================================

function OrionTimeline({
  events,
  reverse = false,
  maxItems,
  showMore = true,
  onShowMore,
  pending = false,
  mode = 'left',
}: TimelineProps) {
  const displayEvents = maxItems ? events.slice(0, maxItems) : events;
  const hasMore = maxItems ? events.length > maxItems : false;

  const items = displayEvents.map((event) => {
    const color = event.color || getStatusColor(event.status);

    return {
      key: event.id ?? event.time.toString(),
      color,
      dot: event.icon,
      children: (
        <div
          style={{
            marginLeft: 4,
          }}
        >
          {/* Title row with status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontWeight: 500,
                fontSize: 14,
                color: 'var(--text-primary, #1f1f1f)',
              }}
            >
              {event.title}
            </span>
            {event.status && (
              <StatusBadge status={event.status} size="small" showDot={false} variant="subtle" />
            )}
          </div>

          {/* Time */}
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary, #8c8c8c)',
              marginBottom: event.description ? 4 : 0,
            }}
          >
            {formatTime(event.time)}
          </div>

          {/* Description */}
          {event.description && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary, #434343)',
                lineHeight: 1.5,
              }}
            >
              {event.description}
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <div className="orion-timeline" data-testid="orion-timeline">
      <AntTimeline
        mode={mode}
        reverse={reverse}
        pending={pending}
        pendingDot={
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#1890ff',
              animation: 'status-pulse 1.5s ease-in-out infinite',
            }}
          />
        }
        items={items}
      />

      {hasMore && showMore && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a
            onClick={onShowMore}
            style={{
              color: '#1890ff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Show More ({events.length - (maxItems ?? 0)} more)
          </a>
        </div>
      )}
    </div>
  );
}

export default OrionTimeline;
