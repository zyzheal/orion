/**
 * FlameDetailPanel.tsx - 火焰图节点详情面板
 * 抽取自 PerformanceFlameGraphPage.tsx (P2-9 Phase 44)
 * 显示选中 frame 的: 名称、值/占比、分类、类型、子调用栈、调用栈路径
 */
import React from 'react';
import { Card, Typography, Tag, Statistic, Button } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { spacing, shadows, radius } from '@/tokens';
import { colors } from '@/tokens/colors';
import {
  colorByDepth,
  textColorByDepth,
  formatValue,
  formatPct,
  type RenderRow,
} from './PerformanceFlameGraphConfig';
import type { FlameGraphFrame } from '@/api/flamegraph';

const { Text } = Typography;

export interface FlameDetailPanelProps {
  frame: FlameGraphFrame;
  depth: number;
  totalValue: number;
  allRows: RenderRow[];
  unit: string;
  onClose: () => void;
}

export const FlameDetailPanel: React.FC<FlameDetailPanelProps> = ({
  frame,
  depth,
  totalValue,
  unit,
  onClose,
}) => {
  const pct = totalValue > 0 ? (frame.value / totalValue) * 100 : 0;
  const color = colorByDepth(depth);
  const children = frame.children || [];
  const isLeaf = children.length === 0;

  return (
    <Card
      size="small"
      style={{
        boxShadow: shadows.sm,
        borderRadius: radius.lg,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      bodyStyle={{ padding: spacing.md, flex: 1, overflow: 'auto' }}
    >
      {/* 关闭按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Tag
          color={color}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            backgroundColor: color,
            color: textColorByDepth(depth),
            border: 'none',
          }}
        >
          depth {depth}
        </Tag>
        <Button type="text" size="small" icon={<InfoCircleOutlined />} onClick={onClose} />
      </div>

      {/* 函数名 */}
      <div style={{ marginTop: spacing.sm }}>
        <Text code style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>
          {frame.name}
        </Text>
      </div>

      {/* 统计 */}
      <div style={{ marginTop: spacing.md }}>
        <Statistic
          title={<Text type="secondary">值 ({unit})</Text>}
          value={formatValue(frame.value)}
          valueStyle={{ fontSize: 22, color: color }}
        />
        <Statistic
          title={<Text type="secondary">占比</Text>}
          value={formatPct(pct)}
          precision={1}
          suffix="%"
          valueStyle={{ fontSize: 22, color: colors.primary[500] }}
        />
      </div>

      {/* 分类 */}
      {frame.category && (
        <div style={{ marginTop: spacing.sm }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            分类
          </Text>
          <Tag style={{ marginLeft: spacing.sm, fontSize: 11 }}>{frame.category}</Tag>
        </div>
      )}

      {/* 是否叶子节点 */}
      <div style={{ marginTop: spacing.sm }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          类型
        </Text>
        <Tag
          color={isLeaf ? colors.success[500] : colors.info[500]}
          style={{ marginLeft: spacing.sm, fontSize: 11 }}
        >
          {isLeaf ? '叶子节点' : '父节点'}
        </Tag>
      </div>

      {/* 子调用栈 */}
      {children.length > 0 && (
        <div style={{ marginTop: spacing.md }}>
          <Text strong style={{ fontSize: 12 }}>
            子调用栈 ({children.length})
          </Text>
          <div style={{ marginTop: spacing.xs, maxHeight: 180, overflow: 'auto' }}>
            {children.map((child, i) => {
              const childPct = frame.value > 0 ? (child.value / frame.value) * 100 : 0;
              const barColor = colorByDepth(depth + 1);
              return (
                <div
                  key={String(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: spacing.xs,
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      backgroundColor: barColor,
                      borderRadius: 1,
                      marginRight: spacing.xs,
                      flexShrink: 0,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {child.name}
                  </Text>
                  <Text type="secondary" style={{ marginLeft: spacing.xs }}>
                    {formatValue(child.value)} ({childPct.toFixed(1)}%)
                  </Text>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 调用栈路径 */}
      <div style={{ marginTop: spacing.md }}>
        <Text strong style={{ fontSize: 12 }}>
          调用栈路径
        </Text>
        <div style={{ marginTop: spacing.xs }}>
          <Text code style={{ fontSize: 10, wordBreak: 'break-all', color: colors.neutral[600] }}>
            {frame.name}
          </Text>
        </div>
      </div>
    </Card>
  );
};

export default FlameDetailPanel;
