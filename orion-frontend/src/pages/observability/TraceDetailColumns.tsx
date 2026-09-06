/**
 * TraceDetailColumns (P2-9)
 * Trace 详情页的树形列渲染器和 Span 详情弹窗组件。
 *
 * 包含:
 * - TREE_COLUMNS: 左侧树形列的列头配置
 * - SpanDetailPopover: Span 悬停时显示的详情卡片
 * - TreeNodeRow: 树形行渲染器（折叠/展开、悬停高亮、选中状态）
 */

import React from 'react';
import { Typography, Tag } from 'antd';
import { spacing, radius, themeVars } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  ROW_GAP,
  SpanNode,
  formatDuration,
  formatTime,
  isSpanError,
  statusColor,
  statusLabel,
} from './TraceDetailConfig';

const { Text } = Typography;

// ---- 树形列表头配置 ----

/** 左侧树形列的列头结构定义 */
export const TREE_COLUMNS = [
  { key: 'indent', width: 16, render: '\u00A0' },
  { key: 'name', flex: 1, title: 'Span' },
  { key: 'duration', align: 'right', title: 'Duration' },
] as const;

// ---- Span 详情弹窗 ----

export const SpanDetailPopover: React.FC<{ span: import('@/api/trace').Span }> = ({ span }) => {
  const hasAttributes = span.attributes && Object.keys(span.attributes).length > 0;
  const hasEvents = span.events && span.events.length > 0;

  return (
    <div style={{ minWidth: 240, maxWidth: 360 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong>{span.name}</Text>
        <Tag color={statusColor(span.statusCode)} style={{ marginLeft: 8 }}>
          {statusLabel(span.statusCode)}
        </Tag>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '80px 1fr',
          rowGap: 4,
          columnGap: 8,
          fontSize: 12,
        }}
      >
        <Text type="secondary">Trace ID</Text>
        <Text code style={{ wordBreak: 'break-all' }}>{span.traceId}</Text>

        <Text type="secondary">Span ID</Text>
        <Text code style={{ wordBreak: 'break-all' }}>{span.spanId}</Text>

        <Text type="secondary">Parent ID</Text>
        <Text code style={{ wordBreak: 'break-all' }}>{span.parentId || '-'}</Text>

        {span.service && (
          <>
            <Text type="secondary">Service</Text>
            <Text>{span.service}</Text>
          </>
        )}

        {span.kind && (
          <>
            <Text type="secondary">Kind</Text>
            <Text>{span.kind}</Text>
          </>
        )}

        <Text type="secondary">Duration</Text>
        <Text strong>{formatDuration(span.durationNs)}</Text>

        <Text type="secondary">Start</Text>
        <Text>{formatTime(span.startTime)}</Text>

        <Text type="secondary">End</Text>
        <Text>{formatTime(span.endTime)}</Text>

        {span.statusMessage && (
          <>
            <Text type="secondary" style={{ color: colors.error[500] }}>
              Message
            </Text>
            <Text style={{ color: colors.error[500] }}>{span.statusMessage}</Text>
          </>
        )}
      </div>

      {hasAttributes && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Attributes
          </Text>
          <div
            style={{
              maxHeight: 120,
              overflow: 'auto',
              backgroundColor: themeVars.bgSecondary,
              borderRadius: radius.xs,
              padding: 8,
              fontSize: 11,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {JSON.stringify(span.attributes, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {hasEvents && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Events ({span.events!.length})
          </Text>
          <div style={{ maxHeight: 80, overflow: 'auto', fontSize: 11 }}>
            {span.events!.map((ev, i) => (
              <div
                key={String(i)}
                style={{
                  padding: '2px 0',
                  borderLeft: `2px solid ${colors.primary[400]}`,
                  paddingLeft: 6,
                  marginBottom: 2,
                }}
              >
                <Text code>{ev.name}</Text>
                <Text type="secondary" style={{ marginLeft: 4 }}>
                  {formatTime(ev.timestamp)}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---- 树形行组件 ----

export interface TreeNodeRowProps {
  node: SpanNode;
  rowIdx: number;
  treeColWidth: number;
  rowHeight: number;
  collapsed: Set<string>;
  onToggle: (spanId: string) => void;
  hoveredSpanId: string | null;
  onMouseEnter: (spanId: string, y: number) => void;
  onMouseLeave: () => void;
  selectedSpanId: string | null;
  onSelect: (spanId: string) => void;
}

export const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  rowIdx,
  treeColWidth,
  rowHeight,
  collapsed,
  onToggle,
  hoveredSpanId,
  onMouseEnter,
  onMouseLeave,
  selectedSpanId,
  onSelect,
}) => {
  const { span, depth } = node;
  const isError = isSpanError(span);
  const isHovered = hoveredSpanId === span.spanId;
  const isSelected = selectedSpanId === span.spanId;
  const isCollapsed = collapsed.has(span.spanId);
  const hasChildren = node.children.length > 0;

  const indent = depth * 16 + 8;
  const bgColor = isSelected
    ? colors.primary[50]
    : isHovered
      ? themeVars.bgSecondary
      : 'transparent';

  const toggleIcon = hasChildren ? (isCollapsed ? '▸' : '▾') : '\u00A0';

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: rowIdx * (rowHeight + ROW_GAP),
        width: treeColWidth,
        height: rowHeight,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${spacing.sm}`,
        backgroundColor: bgColor,
        borderBottom: `1px solid ${themeVars.borderLight}`,
        cursor: 'pointer',
        userSelect: 'none',
        fontSize: 13,
      }}
      onMouseEnter={() => onMouseEnter(span.spanId, rowIdx)}
      onMouseLeave={onMouseLeave}
      onClick={() => onSelect(span.spanId)}
    >
      <span
        style={{
          width: 16,
          textAlign: 'center',
          color: hasChildren ? colors.neutral[500] : 'transparent',
          fontSize: 10,
          marginRight: 4,
          flexShrink: 0,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={(e) => {
          if (hasChildren) {
            e.stopPropagation();
            onToggle(span.spanId);
          }
        }}
      >
        {toggleIcon}
      </span>
      <span style={{ width: indent, flexShrink: 0 }} />
      <span style={{ flexShrink: 0 }}>
        {span.service ? (
          <Tag
            color={statusColor(span.statusCode)}
            style={{
              fontSize: 10,
              padding: '0 4px',
              lineHeight: '16px',
              marginRight: 4,
            }}
          >
            {span.service}
          </Tag>
        ) : null}
        <Text
          style={{
            fontSize: 12,
            color: isError ? colors.error[500] : colors.neutral[900],
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: treeColWidth - indent - 80,
            display: 'inline-block',
            verticalAlign: 'middle',
          }}
        >
          {span.name}
        </Text>
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.neutral[500], flexShrink: 0 }}>
        {formatDuration(span.durationNs)}
      </span>
    </div>
  );
};
