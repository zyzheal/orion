/**
 * DAG Graph Component - Pipeline 依赖关系 DAG 可视化
 *
 * 使用 ReactFlow 展示 Pipeline Stage 之间的依赖关系
 * 支持：节点状态、并行执行、交互式查看
 */
import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  NodeTypes,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Typography, Tooltip, Badge, Space } from 'antd';
import { colors } from '@/tokens';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// ==================== Node Status Colors ====================
const statusColors: Record<string, string> = {
  pending: colors.neutral[300],
  running: colors.primary[500],
  success: colors.success[500],
  failed: colors.error[500],
  skipped: colors.neutral[400],
  cancelled: colors.warning[500],
};

const statusBgColors: Record<string, string> = {
  pending: colors.neutral[100],
  running: colors.primary[100],
  success: colors.success[100],
  failed: colors.error[100],
  skipped: colors.neutral[50],
  cancelled: colors.warning[100],
};

// ==================== Stage Node Component ====================
interface StageNodeData {
  name: string;
  type: string;
  status: string;
  duration?: number;
  index: number;
  stepsCount?: number;
  startedAt?: string;
  completedAt?: string;
}

const StageNode: React.FC<{ data: StageNodeData }> = ({ data }) => {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const statusIcon = useMemo(() => {
    switch (data.status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: colors.success[500] }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: colors.error[500] }} />;
      case 'running':
        return <SyncOutlined spin style={{ color: colors.primary[500] }} />;
      case 'pending':
        return <ClockCircleOutlined style={{ color: colors.neutral[400] }} />;
      case 'skipped':
        return <PauseCircleOutlined style={{ color: colors.neutral[400] }} />;
      default:
        return <PlayCircleOutlined />;
    }
  }, [data.status]);

  return (
    <Tooltip
      title={
        <Space direction="vertical" size={4}>
          <Text strong>{data.name}</Text>
          <Text type="secondary">类型: {data.type}</Text>
          <Text type="secondary">状态: {data.status}</Text>
          <Text type="secondary">耗时: {formatDuration(data.duration)}</Text>
          {data.stepsCount && <Text type="secondary">步骤数: {data.stepsCount}</Text>}
        </Space>
      }
      placement="top"
    >
      <div
        style={{
          padding: '12px 20px',
          borderRadius: 8,
          border: `2px solid ${statusColors[data.status] || colors.neutral[300]}`,
          background: statusBgColors[data.status] || colors.neutral[100],
          minWidth: 120,
          boxShadow: data.status === 'running' ? '0 0 12px rgba(24,144,255,0.4)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: colors.neutral[400],
            width: 8,
            height: 8,
            top: -4,
          }}
        />

        {/* Node Content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge
            count={data.index + 1}
            style={{
              backgroundColor: statusColors[data.status] || colors.neutral[300],
              color: colors.neutral[0],
              fontSize: 10,
              minWidth: 18,
              height: 18,
              lineHeight: '18px',
            }}
          />
          <Text strong style={{ fontSize: 12 }}>
            {data.name}
          </Text>
          {statusIcon}
        </div>

        {/* Duration */}
        {data.duration && (
          <Text type="secondary" style={{ fontSize: 10, marginTop: 4, display: 'block' }}>
            {formatDuration(data.duration)}
          </Text>
        )}

        {/* Output Handle */}
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: statusColors[data.status] || colors.neutral[300],
            width: 8,
            height: 8,
            bottom: -4,
          }}
        />
      </div>
    </Tooltip>
  );
};

// Custom Node Types
const nodeTypes: NodeTypes = {
  stageNode: StageNode,
};

// ==================== DAG Graph Props ====================
interface DAGGraphProps {
  stages: Array<{
    id: string;
    name: string;
    type: string;
    status?: string;
    duration?: number;
    dependsOn?: string[];
    steps?: Array<{ name: string; status?: string }>;
    startTime?: string;
    endTime?: string;
  }>;
  height?: number;
  showMiniMap?: boolean;
  onNodeClick?: (nodeId: string, data: any) => void;
}

/**
 * DAG Graph - Pipeline 依赖关系可视化
 */
const DAGGraph: React.FC<DAGGraphProps> = ({
  stages,
  height = 400,
  showMiniMap = true,
  onNodeClick,
}) => {
  // 构建 DAG Nodes
  const nodes: Node[] = useMemo(() => {
    // 计算每个节点的层级 (基于依赖深度)
    const nodeLevels: Map<string, number> = new Map();

    const getLevel = (stageName: string, visited: Set<string> = new Set()): number => {
      if (visited.has(stageName)) return 0; // 循环依赖保护
      visited.add(stageName);

      const stage = stages.find((s) => s.name === stageName);
      if (!stage?.dependsOn?.length) return 0;

      const maxParentLevel = Math.max(
        ...stage.dependsOn.map((dep) => getLevel(dep, visited))
      );
      return maxParentLevel + 1;
    };

    stages.forEach((stage) => {
      nodeLevels.set(stage.name, getLevel(stage.name));
    });

    // 按层级分组
    const levelGroups: Map<number, string[]> = new Map();
    stages.forEach((stage) => {
      const level = nodeLevels.get(stage.name) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(stage.name);
    });

    // 计算节点位置
    const maxLevel = Math.max(...Array.from(nodeLevels.values()));
    const levelHeight = 120; // 每层高度
    const nodeWidth = 140; // 节点宽度估计

    return stages.map((stage, index) => {
      const level = nodeLevels.get(stage.name) || 0;
      const nodesInLevel = levelGroups.get(level) || [];
      const posInLevel = nodesInLevel.indexOf(stage.name);
      const levelWidth = nodesInLevel.length * nodeWidth;
      const startX = -levelWidth / 2 + nodeWidth / 2;

      return {
        id: stage.id || `stage-${index}`,
        type: 'stageNode',
        data: {
          name: stage.name,
          type: stage.type || 'custom',
          status: stage.status || 'pending',
          duration: stage.duration,
          index,
          stepsCount: stage.steps?.length,
          startedAt: stage.startTime,
          completedAt: stage.endTime,
        },
        position: {
          x: startX + posInLevel * nodeWidth,
          y: level * levelHeight,
        },
      };
    });
  }, [stages]);

  // 构建 DAG Edges
  const edges: Edge[] = useMemo(() => {
    const edgeList: Edge[] = [];

    stages.forEach((stage) => {
      if (stage.dependsOn?.length) {
        stage.dependsOn.forEach((depName) => {
          const depStage = stages.find((s) => s.name === depName);
          if (depStage) {
            const depId = depStage.id || `stage-${stages.indexOf(depStage)}`;
            const sourceId = stage.id || `stage-${stages.indexOf(stage)}`;

            // 根据状态设置边样式
            const isPathSuccess = depStage.status === 'success' && stage.status !== 'pending';
            const isPathFailed = depStage.status === 'failed';

            edgeList.push({
              id: `edge-${depId}-${sourceId}`,
              source: depId,
              target: sourceId,
              type: 'smoothstep',
              animated: stage.status === 'running' && depStage.status === 'success',
              style: {
                stroke: isPathFailed
                  ? colors.error[400]
                  : isPathSuccess
                    ? colors.success[400]
                    : colors.neutral[300],
                strokeWidth: 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: isPathFailed
                  ? colors.error[400]
                  : isPathSuccess
                    ? colors.success[400]
                    : colors.neutral[300],
              },
            });
          }
        });
      }
    });

    return edgeList;
  }, [stages]);

  // Node Click Handler
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id, node.data);
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ height, width: '100%', background: colors.neutral[50], borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        attributionPosition="bottom-left"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
      >
        <Background color={colors.neutral[200]} gap={16} />
        <Controls
          style={{
            button: {
              backgroundColor: colors.neutral[100],
              border: `1px solid ${colors.neutral[200]}`,
            },
          }}
        />
        {showMiniMap && (
          <MiniMap
            nodeColor={(node: Node) => statusColors[node.data?.status || 'pending']}
            maskColor="rgba(0, 0, 0, 0.1)"
            style={{
              background: colors.neutral[100],
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
};

export default DAGGraph;

// ==================== Utility: Validate DAG ====================
export function validateDAG(stages: DAGGraphProps['stages']): {
  valid: boolean;
  errors: string[];
  cycles: string[][];
} {
  const errors: string[] = [];
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // 检查循环依赖
  const detectCycle = (stageName: string, path: string[] = []): boolean => {
    if (recursionStack.has(stageName)) {
      cycles.push([...path, stageName]);
      return true;
    }
    if (visited.has(stageName)) return false;

    visited.add(stageName);
    recursionStack.add(stageName);

    const stage = stages.find((s) => s.name === stageName);
    if (stage?.dependsOn) {
      for (const dep of stage.dependsOn) {
        if (!stages.find((s) => s.name === dep)) {
          errors.push(`Stage "${stageName}" depends on non-existent stage "${dep}"`);
        } else if (detectCycle(dep, [...path, stageName])) {
          return true;
        }
      }
    }

    recursionStack.delete(stageName);
    return false;
  };

  stages.forEach((stage) => {
    if (!visited.has(stage.name)) {
      detectCycle(stage.name);
    }
  });

  if (cycles.length > 0) {
    errors.push(`发现循环依赖: ${cycles.map((c) => c.join(' → ')).join('; ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    cycles,
  };
}

// ==================== Utility: Calculate Execution Order ====================
export function calculateExecutionOrder(stages: DAGGraphProps['stages']): string[][] {
  // 拓扑排序，按层级分组
  const result: string[][] = [];
  const completed = new Set<string>();
  const remaining = [...stages];

  while (remaining.length > 0) {
    // 找出当前可执行的节点 (所有依赖已完成)
    const ready = remaining.filter(
      (stage) =>
        !stage.dependsOn?.length ||
        stage.dependsOn.every((dep) => completed.has(dep))
    );

    if (ready.length === 0) {
      // 存在循环依赖或无法继续
      break;
    }

    // 添加当前层级
    result.push(ready.map((s) => s.name));

    // 标记完成
    ready.forEach((stage) => completed.add(stage.name));

    // 移除已处理的节点
    ready.forEach((stage) => {
      const idx = remaining.indexOf(stage);
      if (idx !== -1) remaining.splice(idx, 1);
    });
  }

  return result;
}