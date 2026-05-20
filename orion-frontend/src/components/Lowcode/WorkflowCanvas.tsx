/**
 * WorkflowCanvas - 工作流画布
 * 使用 SVG 渲染节点和连线，支持拖拽放置、节点选择和连接
 */
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Typography, Empty } from 'antd';
import { colors } from '@/tokens';
import { componentRadius } from '@/tokens/radius';
import { shadows } from '@/tokens/shadows';
import { spacing } from '@/tokens/spacing';
import { animation } from '@/tokens/animation';
import type { WorkflowNodeType, WorkflowCanvasNode, WorkflowCanvasEdge } from './types';
import { nodeTypeConfig, createDefaultNodeConfig } from './types';

const { Text } = Typography;

// ==================== 常量 ====================

/** 节点卡片宽度 */
const NODE_WIDTH = 160;
/** 节点卡片高度 */
const NODE_HEIGHT = 56;
/** 连线端点半径 */
const HANDLE_RADIUS = 6;
/** 画布网格大小（吸附用） */
const GRID_SIZE = 20;

/** 节点类型对应的 SVG 图标路径 */
const nodeSvgIcons: Record<WorkflowNodeType, React.ReactNode> = {
  start: (
    <polygon points="4,2 4,10 10,6" fill="currentColor" />
  ),
  approval: (
    <>
      <circle cx="6" cy="3.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 11c0-2.2 1.8-4 4-4s4 1.8 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  condition: (
    <path d="M3 6 L6 2 L9 6 L6 10 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
  ),
  notification: (
    <>
      <path d="M3 8c0-2 1.3-3 3-3s3 1 3 3v2l1 1H2l1-1V8z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 12a1 1 0 001 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  webhook: (
    <>
      <path d="M5 3L2 6l3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 3h2M6 9h2M2 6h10" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
  end: (
    <>
      <rect x="2" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="5" x2="7" y2="7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7" y1="5" x2="5" y2="7" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
};

// ==================== 子组件 ====================

/**
 * 连线组件 - 贝塞尔曲线连接两个节点
 */
const EdgePath: React.FC<{
  edge: WorkflowCanvasEdge;
  sourceNode: WorkflowCanvasNode | undefined;
  targetNode: WorkflowCanvasNode | undefined;
}> = ({ edge, sourceNode, targetNode }) => {
  if (!sourceNode || !targetNode) return null;

  const startX = sourceNode.position.x + NODE_WIDTH;
  const startY = sourceNode.position.y + NODE_HEIGHT / 2;
  const endX = targetNode.position.x;
  const endY = targetNode.position.y + NODE_HEIGHT / 2;

  // 贝塞尔曲线控制点
  const dx = Math.abs(endX - startX) * 0.5;
  const path = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

  return (
    <g>
      {/* 背景线（更粗，用于鼠标交互） */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: 'pointer' }}
      />
      {/* 实际连线 */}
      <path
        d={path}
        fill="none"
        stroke={colors.neutral[300]}
        strokeWidth={2}
        markerEnd="url(#arrowhead)"
      />
      {/* 标签 */}
      {edge.label && (
        <g>
          <rect
            x={(startX + endX) / 2 - 20}
            y={(startY + endY) / 2 - 8}
            width={40}
            height={16}
            rx={4}
            fill={colors.light.bg.primary}
            stroke={colors.light.border.heavy}
            strokeWidth={1}
          />
          <text
            x={(startX + endX) / 2}
            y={(startY + endY) / 2 + 3}
            textAnchor="middle"
            fontSize={10}
            fill={colors.neutral[600]}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
};

/**
 * 节点端口（连接点）
 */
const NodeHandle: React.FC<{
  x: number;
  y: number;
  type: 'source' | 'target';
}> = ({ x, y, type }) => (
  <circle
    cx={x}
    cy={y}
    r={HANDLE_RADIUS}
    fill={colors.light.bg.primary}
    stroke={type === 'source' ? colors.primary[400] : colors.success[400]}
    strokeWidth={1.5}
    style={{ cursor: 'crosshair' }}
  />
);

/**
 * 单个节点卡片
 */
const WorkflowNodeCard: React.FC<{
  node: WorkflowCanvasNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragNodeStart: (event: React.MouseEvent, nodeId: string) => void;
}> = ({ node, isSelected, onSelect, onDragNodeStart }) => {
  const config = nodeTypeConfig[node.type];

  return (
    <g
      transform={`translate(${node.position.x}, ${node.position.y})`}
      style={{ cursor: 'move' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onDragNodeStart(e, node.id);
      }}
    >
      {/* 选中外发光 */}
      {isSelected && (
        <rect
          x={-3}
          y={-3}
          width={NODE_WIDTH + 6}
          height={NODE_HEIGHT + 6}
          rx={componentRadius.lg}
          fill="none"
          stroke={colors.primary[500]}
          strokeWidth={2}
          style={{
            filter: `drop-shadow(0 0 4px ${colors.primary[200]})`,
          }}
        />
      )}

      {/* 节点主体 */}
      <rect
        x={0}
        y={0}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={componentRadius.lg}
        fill={colors.light.bg.primary}
        stroke={isSelected ? colors.primary[500] : colors.light.border.heavy}
        strokeWidth={1.5}
        style={{
          filter: `drop-shadow(${shadows.card})`,
          transition: `all ${animation.duration.fast}ms ${animation.easing.easeOut}`,
        }}
      />

      {/* 左侧装饰线 - 节点类型标识色 */}
      <rect
        x={0}
        y={4}
        width={3}
        height={NODE_HEIGHT - 8}
        rx={1.5}
        fill={config.color}
      />

      {/* 图标背景 */}
      <rect
        x={8}
        y={NODE_HEIGHT / 2 - 12}
        width={24}
        height={24}
        rx={6}
        fill={`${config.color}15`}
      />

      {/* 图标 */}
      <g
        transform={`translate(${16}, ${NODE_HEIGHT / 2 - 8})`}
        style={{ color: config.color }}
      >
        {nodeSvgIcons[node.type]}
      </g>

      {/* 节点名称 */}
      <text
        x={40}
        y={NODE_HEIGHT / 2 - 2}
        fontSize={13}
        fontWeight={600}
        fill={colors.light.text.primary}
      >
        {node.name.length > 12 ? node.name.slice(0, 12) + '...' : node.name}
      </text>

      {/* 节点类型标签 */}
      <text
        x={40}
        y={NODE_HEIGHT / 2 + 12}
        fontSize={10}
        fill={colors.neutral[500]}
      >
        {config.label}
      </text>

      {/* 输出端口（右侧） */}
      {node.type !== 'end' && (
        <NodeHandle
          x={NODE_WIDTH}
          y={NODE_HEIGHT / 2}
          type="source"
        />
      )}

      {/* 输入端口（左侧） */}
      {node.type !== 'start' && (
        <NodeHandle
          x={0}
          y={NODE_HEIGHT / 2}
          type="target"
        />
      )}
    </g>
  );
};

// ==================== 主组件 ====================

export interface WorkflowCanvasProps {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  onNodeAdd?: (node: WorkflowCanvasNode) => void;
  onNodeMove?: (nodeId: string, position: { x: number; y: number }) => void;
  onNodeDelete?: (nodeId: string) => void;
}

/**
 * WorkflowCanvas - SVG 渲染的工作流画布
 * 支持：节点拖拽移动、画布放置、节点选择、连线展示
 */
const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  onNodeAdd,
  onNodeMove,
  onNodeDelete,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // 监听容器大小变化
  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current?.parentElement) {
        const { clientWidth, clientHeight } = svgRef.current.parentElement;
        setCanvasSize({ width: clientWidth, height: clientHeight });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 画布放置处理（拖拽添加节点）
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData(
        'application/node-type'
      ) as WorkflowNodeType;
      if (!nodeType) return;

      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const x = Math.round((event.clientX - svgRect.left) / GRID_SIZE) * GRID_SIZE;
      const y = Math.round((event.clientY - svgRect.top) / GRID_SIZE) * GRID_SIZE;

      const newNode: WorkflowCanvasNode = {
        id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: nodeType,
        name: nodeTypeConfig[nodeType].label,
        position: { x: Math.max(0, x - NODE_WIDTH / 2), y: Math.max(0, y - NODE_HEIGHT / 2) },
        config: createDefaultNodeConfig(nodeType),
      };

      onNodeAdd?.(newNode);
    },
    [onNodeAdd]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  // 节点拖拽移动
  const handleNodeDragStart = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const mouseX = event.clientX - svgRect.left;
      const mouseY = event.clientY - svgRect.top;

      setDraggingNodeId(nodeId);
      setIsDraggingNode(true);
      setDragOffset({
        x: mouseX - node.position.x,
        y: mouseY - node.position.y,
      });
    },
    [nodes]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isDraggingNode || !draggingNodeId || !svgRef.current) return;

      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = event.clientX - svgRect.left;
      const mouseY = event.clientY - svgRect.top;

      const newX = Math.round(
        Math.max(0, mouseX - dragOffset.x) / GRID_SIZE
      ) * GRID_SIZE;
      const newY = Math.round(
        Math.max(0, mouseY - dragOffset.y) / GRID_SIZE
      ) * GRID_SIZE;

      onNodeMove?.(draggingNodeId, { x: newX, y: newY });
    },
    [isDraggingNode, draggingNodeId, dragOffset, onNodeMove]
  );

  const handleMouseUp = useCallback(() => {
    setIsDraggingNode(false);
    setDraggingNodeId(null);
  }, []);

  // 画布空白处点击取消选择
  const handleCanvasClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // 空状态
  if (nodes.length === 0) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${colors.neutral[50]}`,
          borderRadius: componentRadius.card,
          border: `2px dashed ${colors.light.border.heavy}`,
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                从左侧拖拽节点到此处
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                或点击节点自动添加
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: `
          radial-gradient(circle, ${colors.neutral[200]} 1px, transparent 1px)
        `,
        backgroundSize: `${GRID_SIZE * 2}px ${GRID_SIZE * 2}px`,
        borderRadius: componentRadius.card,
        border: `1px solid ${colors.light.border.light}`,
      }}
    >
      <svg
        ref={svgRef}
        width={Math.max(canvasSize.width, 1200)}
        height={Math.max(canvasSize.height, 800)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ display: 'block' }}
      >
        {/* 箭头标记定义 */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth={10}
            markerHeight={7}
            refX={10}
            refY={3.5}
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill={colors.neutral[400]}
            />
          </marker>
        </defs>

        {/* 连线 */}
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          return (
            <EdgePath
              key={edge.id}
              edge={edge}
              sourceNode={sourceNode}
              targetNode={targetNode}
            />
          );
        })}

        {/* 节点 */}
        {nodes.map((node) => (
          <WorkflowNodeCard
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onSelect={(id) => onNodeSelect?.(id)}
            onDragNodeStart={handleNodeDragStart}
          />
        ))}
      </svg>
    </div>
  );
};

export default WorkflowCanvas;
