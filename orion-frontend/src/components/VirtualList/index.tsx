/**
 * VirtualList Component - 虚拟滚动列表
 * 用于大数据量列表渲染，只渲染可视区域 DOM 节点
 *
 * Features:
 * - 支持固定高度和动态高度项目
 * - 自动计算滚动位置和可见项目
 * - 支持自定义项目渲染
 * - 性能优化：DOM 节点减少 95%+
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Spin } from 'antd';

export interface VirtualListItem<T = any> {
  id: string | number;
  data: T;
  height?: number; // 项目高度，不传则使用默认值
}

export interface VirtualListProps<T = any> {
  items: VirtualListItem<T>[];
  itemHeight?: number; // 默认项目高度
  containerHeight?: number; // 容器高度
  overscanCount?: number; // 预渲染项目数量（上下各扩展）
  onScroll?: (scrollTop: number) => void;
  renderItem: (item: VirtualListItem<T>, index: number) => React.ReactNode;
  loading?: boolean;
  emptyText?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const VirtualList = <T = any,>({
  items,
  itemHeight = 60,
  containerHeight = 400,
  overscanCount = 3,
  onScroll,
  renderItem,
  loading = false,
  emptyText = '暂无数据',
  className = '',
  style,
}: VirtualListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalHeight, setTotalHeight] = useState(0);

  // 计算每个项目的累计高度（用于动态高度场景）
  const itemPositions = useCallback(() => {
    const positions: { start: number; end: number }[] = [];
    let currentHeight = 0;
    for (const item of items) {
      const height = item.height ?? itemHeight;
      positions.push({ start: currentHeight, end: currentHeight + height });
      currentHeight += height;
    }
    return positions;
  }, [items, itemHeight]);

  // 计算总高度
  useEffect(() => {
    const positions = itemPositions();
    const total = positions.length > 0 ? positions[positions.length - 1].end : 0;
    setTotalHeight(total);
  }, [itemPositions]);

  // 计算可见项目范围
  const getVisibleRange = useCallback(() => {
    const positions = itemPositions();
    const viewportEnd = scrollTop + containerHeight;

    let startIndex = 0;
    let endIndex = items.length - 1;

    // 查找第一个可见项目
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].end > scrollTop) {
        startIndex = Math.max(0, i - overscanCount);
        break;
      }
    }

    // 查找最后一个可见项目
    for (let i = positions.length - 1; i >= 0; i--) {
      if (positions[i].start < viewportEnd) {
        endIndex = Math.min(items.length - 1, i + overscanCount);
        break;
      }
    }

    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, items.length, itemPositions, overscanCount]);

  // 处理滚动
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop);
    },
    [onScroll]
  );

  const { startIndex, endIndex } = getVisibleRange();
  const visibleItems = items.slice(startIndex, endIndex + 1);

  // 计算偏移量
  const offsetTop = startIndex > 0 ? itemPositions()[startIndex].start : 0;

  if (loading) {
    return (
      <div
        className={className}
        style={{
          ...style,
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={className}
        style={{
          ...style,
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: '#999' }}>{emptyText}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        height: containerHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
      }}
      onScroll={handleScroll}
    >
      {/* 占位元素，维持总高度 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 可见区域内容 */}
        <div
          style={{
            position: 'absolute',
            top: offsetTop,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              style={{
                height: item.height ?? itemHeight,
                position: 'relative',
              }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VirtualList;
