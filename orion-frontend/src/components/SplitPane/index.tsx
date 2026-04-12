/**
 * SplitPane Component
 * - Resizable split panel layout
 * - Supports horizontal and vertical splits
 * - Used for master-detail views, resizable sidebars
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPaneProps {
  /** First pane (left or top) */
  first: React.ReactNode;
  /** Second pane (right or bottom) */
  second: React.ReactNode;
  /** Split direction */
  direction?: SplitDirection;
  /** Initial split position (percentage 0-100) */
  defaultSplit?: number;
  /** Controlled split position */
  split?: number;
  /** Handler for split change */
  onSplitChange?: (split: number) => void;
  /** Minimum size of first pane (px) */
  minFirstSize?: number;
  /** Minimum size of second pane (px) */
  minSecondSize?: number;
  /** Splitter bar size */
  splitterSize?: number;
  /** Splitter bar color */
  splitterColor?: string;
  /** Whether the split is resizable */
  resizable?: boolean;
  /** Pane styles */
  firstStyle?: React.CSSProperties;
  secondStyle?: React.CSSProperties;
}

// ============================================================================
// Component
// ============================================================================

function SplitPane({
  first,
  second,
  direction = 'horizontal',
  defaultSplit = 50,
  split: controlledSplit,
  onSplitChange,
  minFirstSize = 100,
  minSecondSize = 100,
  splitterSize = 6,
  splitterColor = 'var(--border-default, #d9d9d9)',
  resizable = true,
  firstStyle,
  secondStyle,
}: SplitPaneProps) {
  const [internalSplit, setInternalSplit] = useState(defaultSplit);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const currentSplit = controlledSplit !== undefined ? controlledSplit : internalSplit;

  const handleMouseDown = useCallback(() => {
    if (!resizable) return;
    isDragging.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [resizable, direction]);

  useEffect(() => {
    if (!resizable) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();

      let newSplit: number;
      if (direction === 'horizontal') {
        const x = e.clientX - rect.left;
        newSplit = (x / rect.width) * 100;
      } else {
        const y = e.clientY - rect.top;
        newSplit = (y / rect.height) * 100;
      }

      // Apply constraints
      const containerSize =
        direction === 'horizontal'
          ? containerRef.current.offsetWidth
          : containerRef.current.offsetHeight;

      const minFirstPercent = (minFirstSize / containerSize) * 100;
      const minSecondPercent = (minSecondSize / containerSize) * 100;

      newSplit = Math.max(minFirstPercent, Math.min(100 - minSecondPercent, newSplit));
      newSplit = Math.max(5, Math.min(95, newSplit));

      if (onSplitChange) {
        onSplitChange(newSplit);
      } else {
        setInternalSplit(newSplit);
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    resizable,
    direction,
    onSplitChange,
    minFirstSize,
    minSecondSize,
  ]);

  const isVertical = direction === 'vertical';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  };

  const firstPaneStyle: React.CSSProperties = {
    flex: `0 0 ${currentSplit}%`,
    overflow: 'auto',
    minWidth: isVertical ? '100%' : minFirstSize,
    minHeight: isVertical ? minFirstSize : '100%',
    ...firstStyle,
  };

  const splitterStyle: React.CSSProperties = {
    flex: `0 0 ${splitterSize}px`,
    background: splitterColor,
    cursor: resizable ? (isVertical ? 'row-resize' : 'col-resize') : 'default',
    position: 'relative',
    zIndex: 1,
  };

  const secondPaneStyle: React.CSSProperties = {
    flex: '1 1 auto',
    overflow: 'auto',
    minWidth: isVertical ? '100%' : minSecondSize,
    minHeight: isVertical ? minSecondSize : '100%',
    ...secondStyle,
  };

  return (
    <div
      ref={containerRef}
      className="orion-split-pane"
      style={containerStyle}
      data-testid="orion-split-pane"
    >
      {/* First pane */}
      <div style={firstPaneStyle} data-testid="split-pane-first">
        {first}
      </div>

      {/* Splitter */}
      <div
        style={splitterStyle}
        onMouseDown={handleMouseDown}
        data-testid="split-pane-splitter"
      >
        {/* Visual indicator */}
        {resizable && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: isVertical ? 20 : 4,
              height: isVertical ? 4 : 20,
              background: 'var(--color-primary-400, #40a9ff)',
              borderRadius: 2,
              opacity: 0.6,
            }}
          />
        )}
      </div>

      {/* Second pane */}
      <div style={secondPaneStyle} data-testid="split-pane-second">
        {second}
      </div>
    </div>
  );
}

export default SplitPane;
