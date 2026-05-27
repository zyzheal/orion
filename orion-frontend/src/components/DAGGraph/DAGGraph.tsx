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
import { Typography, Tooltip, Badge, Space, ConfigProvider } from 'antd';

// Tooltip 白色主题 token
const tooltipTheme = {
  token: {
    colorBgSpotlight: '#ffffff',
    colorTextLightSolid: colors.neutral[900],
  },
};

// CSS 样式覆盖 - 确保 Tooltip 背景为白色
const tooltipStyles = `
  .dag-tooltip .ant-tooltip-inner {
    background-color: #ffffff !important;
    color: #1f1f1f !important;
  }
  .dag-tooltip .ant-tooltip-arrow::before {
    background-color: #ffffff !important;
  }
`;
import dayjs from 'dayjs';
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

const statusLabels: Record<string, string> = {
  success: '成功',
  failed: '失败',
  running: '运行中',
  pending: '等待中',
  skipped: '已跳过',
  cancelled: '已取消',
};

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
      color='#ffffff'
      title={
        <div style={{ minWidth: 160 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: colors.neutral[900], paddingBottom: 8, borderBottom: `1px solid #f0f0f0` }}>
            <Space size={6}>
              <Badge
                count={data.index + 1}
                style={{
                  backgroundColor: statusColors[data.status] || '#d9d9d9',
                  color: '#ffffff',
                  fontSize: 10,
                  minWidth: 16,
                  height: 16,
                  lineHeight: '16px',
                }}
              />
              {data.name}
              {statusIcon}
            </Space>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            <InfoRow label="类型" value={data.type} />
            <InfoRow
              label="状态"
              value={statusLabels[data.status] || data.status}
              color={statusColors[data.status]}
            />
            {data.duration != null && (
              <InfoRow label="耗时" value={formatDuration(data.duration)} />
            )}
            {data.stepsCount != null && (
              <InfoRow label="步骤数" value={`${data.stepsCount} 个`} />
            )}
            {data.startedAt && (
              <InfoRow label="开始时间" value={dayjs(data.startedAt).format('HH:mm:ss')} />
            )}
            {data.completedAt && (
              <InfoRow label="完成时间" value={dayjs(data.completedAt).format('HH:mm:ss')} />
            )}
          </div>
        </div>
      }
      overlayInnerStyle={{
        maxWidth: 260,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
        padding: '12px 16px',
      }}
      placement="top"
    >
      <div
        style={{
          padding: '12px 20px',
          borderRadius: 10,
          border: `2px solid ${statusColors[data.status] || colors.neutral[300]}`,
          background: statusBgColors[data.status] || colors.neutral[100],
          minWidth: 140,
          maxWidth: 180,
          height: 64, // 固定高度，确保所有节点一致
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          boxShadow: data.status === 'running' ? '0 0 12px rgba(24,144,255,0.4)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Input Handle — 左侧 */}
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: colors.neutral[400],
            width: 8,
            height: 8,
            left: -4,
          }}
        />

        {/* Node Content — 居中 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
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
            <Text strong style={{ fontSize: 13 }}>
              {data.name}
            </Text>
            {statusIcon}
          </div>

          {data.duration && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatDuration(data.duration)}
            </Text>
          )}
        </div>

        {/* Output Handle — 右侧 */}
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: statusColors[data.status] || colors.neutral[300],
            width: 8,
            height: 8,
            right: -4,
          }}
        />
      </div>
    </Tooltip>
  );
};

// ==================== Tooltip Info Row ====================
interface InfoRowProps {
  label: string;
  value: string;
  color?: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, alignItems: 'center' }}>
    <span style={{ color: 'rgba(0,0,0,0.65)' }}>{label}</span>
    <span style={{ color: color || colors.neutral[800], fontWeight: 500 }}>{value}</span>
  </div>
);

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
  // 构建 DAG Nodes - 水平布局，所有节点 Y 坐标对齐
  const nodes: Node[] = useMemo(() => {
    // 计算每个节点的层级 (基于依赖深度)
    const nodeLevels: Map<string, number> = new Map();

    const getLevel = (stageName: string, visited: Set<string> = new Set()): number => {
      if (visited.has(stageName)) return 0;
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

    // 线性流水线检测：所有 stage 都没有 dependsOn，按索引顺序排列
    const allNoDeps = stages.every((s) => !s.dependsOn?.length);
    if (allNoDeps && stages.length > 1) {
      stages.forEach((stage, index) => {
        nodeLevels.set(stage.name, index);
      });
    }

    // 横向布局参数
    const nodeW = 184;   // 节点宽度
    const nodeH = 72;    // 节点高度（固定）
    const gapX = 80;     // 水平间距 - 确保连接线水平

    // 计算容器中心 Y 坐标（用于垂直居中）
    const centerY = height / 2 - nodeH / 2;

    return stages.map((stage, index) => {
      const level = nodeLevels.get(stage.name) || 0;

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
        // 水平排列：X = level * 间距，Y = 居中位置
        position: {
          x: level * (nodeW + gapX),
          y: centerY,
        },
      };
    });
  }, [stages, height]);

  // 构建 DAG Edges — 全部使用直线
  const edges: Edge[] = useMemo(() => {
    const edgeList: Edge[] = [];

    // 显式依赖连接
    stages.forEach((stage) => {
      if (stage.dependsOn?.length) {
        stage.dependsOn.forEach((depName) => {
          const depStage = stages.find((s) => s.name === depName);
          if (depStage) {
            const depId = depStage.id || `stage-${stages.indexOf(depStage)}`;
            const sourceId = stage.id || `stage-${stages.indexOf(stage)}`;

            const isPathSuccess = depStage.status === 'success' && stage.status !== 'pending';
            const isPathFailed = depStage.status === 'failed';

            edgeList.push({
              id: `edge-${depId}-${sourceId}`,
              source: depId,
              target: sourceId,
              type: 'straight',
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

    // 线性流水线：无显式依赖时，自动添加顺序连接
    const hasAnyDeps = stages.some((s) => s.dependsOn?.length);
    if (!hasAnyDeps && stages.length > 1) {
      for (let i = 0; i < stages.length - 1; i++) {
        const fromId = stages[i].id || `stage-${i}`;
        const toId = stages[i + 1].id || `stage-${i + 1}`;
        const fromStatus = stages[i].status;
        const toStatus = stages[i + 1].status;

        const isPathSuccess = fromStatus === 'success' && toStatus !== 'pending';
        const isPathFailed = fromStatus === 'failed';

        edgeList.push({
          id: `edge-${fromId}-${toId}`,
          source: fromId,
          target: toId,
          type: 'straight',
          animated: toStatus === 'running' && fromStatus === 'success',
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
    }

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
    <>
      <style>{tooltipStyles}</style>
      <ConfigProvider theme={tooltipTheme}>
        <div
          className="dag-tooltip"
          style={{ height, width: '100%', background: colors.neutral[50], borderRadius: 8 }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.15 }}
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
            <Controls />
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
      </ConfigProvider>
    </>
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
  const result: string[][] = [];
  const completed = new Set<string>();
  const remaining = [...stages];

  while (remaining.length > 0) {
    const ready = remaining.filter(
      (stage) =>
        !stage.dependsOn?.length ||
        stage.dependsOn.every((dep) => completed.has(dep))
    );

    if (ready.length === 0) {
      break;
    }

    result.push(ready.map((s) => s.name));
    ready.forEach((stage) => completed.add(stage.name));
    ready.forEach((stage) => {
      const idx = remaining.indexOf(stage);
      if (idx !== -1) remaining.splice(idx, 1);
    });
  }

  return result;
}
