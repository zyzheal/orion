/**
 * Pipeline Canvas Component - 拖拽式流水线编辑器画布
 *
 * 使用 ReactFlow 实现可视化 DAG 编辑
 * 支持：节点拖拽、连线编辑、画布缩放、节点选择
 */
import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  MarkerType,
  NodeTypes,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, Space, Dropdown, message, Tooltip } from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { spacing, colors } from '@/tokens';
import StageNodeComponent from './StageNode';

// Define StageConfig interface locally to avoid circular dependency
interface StageConfig {
  id: string;
  name: string;
  type: string;
  timeout?: number;
  retryCount?: number;
  dependsOn?: string[];
  config?: Record<string, unknown>;
  position?: { x: number; y: number };
}

// ==================== Node Types ====================
const nodeTypes: NodeTypes = {
  stageNode: StageNodeComponent,
  stage: StageNodeComponent,
};

// ==================== Stage Node Data ====================
export interface StageNodeData {
  label: string;
  stageType: string;
  status?: string;
  config?: Record<string, unknown>;
  index: number;
  hasApproval?: boolean;
  timeout?: number;
  hasQualityGate?: boolean;
}

// ==================== Props ====================
interface PipelineCanvasProps {
  stages: StageConfig[];
  onStagesChange: (stages: StageConfig[]) => void;
  onNodeClick?: (nodeId: string, stage: StageConfig) => void;
  onAddStage?: (type: string, position: { x: number; y: number }) => void;
  readOnly?: boolean;
  initialViewport?: { x: number; y: number; zoom: number };
  onSaveLayout?: (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => void;
}

// ==================== Helper Functions ====================
const getStageTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    build: colors.primary[500],
    test: colors.success[500],
    scan: colors.warning[500],
    deploy: colors.error[500],
    notify: colors.info[500],
    custom: colors.neutral[500],
    buildx: colors.primary[600],
    container: colors.primary[400],
  };
  return colorMap[type] || colors.neutral[500];
};

// ==================== Main Canvas Component ====================
const PipelineCanvasInner: React.FC<PipelineCanvasProps> = ({
  stages,
  onStagesChange,
  onNodeClick,
  onAddStage,
  readOnly = false,
  initialViewport,
  onSaveLayout,
}) => {
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Convert stages to ReactFlow nodes
  useEffect(() => {
    const newNodes: Node<StageNodeData>[] = stages.map((stage, index) => {
      // Calculate position based on dependencies (simple layout)
      const level = calculateLevel(stage, stages);
      const nodesInLevel = stages.filter(
        (s) => calculateLevel(s, stages) === level
      );
      const posInLevel = nodesInLevel.findIndex((s) => s.name === stage.name);

      const nodeWidth = 180;
      const levelHeight = 150;
      const levelWidth = nodesInLevel.length * nodeWidth;
      const startX = -levelWidth / 2 + nodeWidth / 2;

      return {
        id: stage.id || `stage-${index}`,
        type: 'stageNode',
        position: {
          x: stage.position?.x ?? startX + posInLevel * nodeWidth,
          y: stage.position?.y ?? level * levelHeight,
        },
        data: {
          label: stage.name,
          stageType: stage.type,
          status: stage.config?.status as string | undefined,
          config: stage.config,
          index,
          hasApproval: !!(stage.config as any)?.approval?.enabled,
          timeout: (stage.config as any)?.timeout?.enabled ? (stage.config as any)?.timeout?.duration : undefined,
          hasQualityGate: !!(stage.config as any)?.qualityGate?.enabled,
        },
        draggable: !readOnly,
        selectable: true,
      };
    });

    // Build edges from dependencies
    const newEdges: Edge[] = [];
    stages.forEach((stage, stageIndex) => {
      if (stage.dependsOn?.length) {
        stage.dependsOn.forEach((depName) => {
          const depStage = stages.find((s) => s.name === depName);
          if (depStage) {
            const sourceId = depStage.id || `stage-${stages.indexOf(depStage)}`;
            const targetId = stage.id || `stage-${stageIndex}`;
            newEdges.push({
              id: `edge-${sourceId}-${targetId}`,
              source: sourceId,
              target: targetId,
              type: 'smoothstep',
              animated: false,
              style: {
                stroke: colors.neutral[400],
                strokeWidth: 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: colors.neutral[400],
              },
              data: {
                dependency: depName,
              },
            });
          }
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [stages, setNodes, setEdges]);

  // Calculate level for node positioning
  const calculateLevel = (stage: StageConfig, allStages: StageConfig[]): number => {
    if (!stage.dependsOn || stage.dependsOn.length === 0) return 0;

    const maxParentLevel = Math.max(
      ...stage.dependsOn.map((depName) => {
        const parentStage = allStages.find((s) => s.name === depName);
        if (!parentStage) return 0;
        return calculateLevel(parentStage, allStages);
      })
    );
    return maxParentLevel + 1;
  };

  // Handle node changes (drag, select, etc.)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;

      setNodes((nds) => applyNodeChanges(changes, nds) as Node<StageNodeData>[]);

      // Handle position changes - update stage position
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && change.dragging === false) {
          const stageIndex = stages.findIndex((s) => s.id === change.id);
          if (stageIndex !== -1) {
            const updatedStages = [...stages];
            updatedStages[stageIndex] = {
              ...updatedStages[stageIndex],
              position: change.position,
            };
            onStagesChange(updatedStages);
          }
        }
      });
    },
    [stages, onStagesChange, readOnly, setNodes]
  );

  // Handle edge changes
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges, readOnly]
  );

  // Handle new connections
  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;

      // Add edge
      const newEdge: Edge = {
        id: `edge-${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: colors.neutral[400],
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: colors.neutral[400],
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));

      // Update stage dependencies
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (targetNode) {
        const stageIndex = stages.findIndex((s) => s.id === connection.target);
        if (stageIndex !== -1) {
          const sourceStageName = nodes.find((n) => n.id === connection.source)?.data.label;
          if (sourceStageName) {
            const updatedStages = [...stages];
            const currentDeps = updatedStages[stageIndex].dependsOn || [];
            if (!currentDeps.includes(sourceStageName)) {
              updatedStages[stageIndex] = {
                ...updatedStages[stageIndex],
                dependsOn: [...currentDeps, sourceStageName],
              };
              onStagesChange(updatedStages);
            }
          }
        }
      }
    },
    [nodes, stages, onStagesChange, setEdges, readOnly]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
      const stage = stages.find((s) => s.id === node.id);
      if (stage && onNodeClick) {
        onNodeClick(node.id, stage);
      }
    },
    [stages, onNodeClick]
  );

  // Delete selected node
  const handleDeleteNode = useCallback(() => {
    if (selectedNodeId && !readOnly) {
      const updatedStages = stages.filter((s) => s.id !== selectedNodeId);
      // Update dependencies
      updatedStages.forEach((stage) => {
        if (stage.dependsOn) {
          const sourceNode = nodes.find((n) => n.id === selectedNodeId);
          if (sourceNode && stage.dependsOn.includes(sourceNode.data.label)) {
            stage.dependsOn = stage.dependsOn.filter((d) => d !== sourceNode.data.label);
          }
        }
      });
      onStagesChange(updatedStages);
      setSelectedNodeId(null);
      message.success('阶段已删除');
    }
  }, [selectedNodeId, stages, nodes, onStagesChange, readOnly]);

  // Stage type menu items
  const stageTypeMenuItems = [
    {
      key: 'build',
      label: '🔨 构建 (Build)',
    },
    {
      key: 'test',
      label: '🧪 测试 (Test)',
    },
    {
      key: 'scan',
      label: '🔍 代码扫描 (Scan)',
    },
    {
      key: 'deploy',
      label: '🚀 部署 (Deploy)',
    },
    {
      key: 'notify',
      label: '📢 通知 (Notify)',
    },
    {
      key: 'custom',
      label: '⚙️ 自定义 (Custom)',
    },
    {
      key: 'buildx',
      label: '🏷️ 多架构构建 (Buildx)',
    },
    {
      key: 'container',
      label: '📦 容器运行 (Container)',
    },
  ];

  const handleAddStage = (type: string) => {
    if (onAddStage) {
      // Calculate center position
      const centerX = 0;
      const centerY = stages.length * 150;
      onAddStage(type, { x: centerX, y: centerY });
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        minHeight: 500,
        background: colors.neutral[50],
        borderRadius: 8,
        border: `1px solid ${colors.neutral[200]}`,
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultViewport={initialViewport || { x: 0, y: 0, zoom: 1 }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        selectionOnDrag={true}
        selectNodesOnDrag={false}
      >
        <Background color={colors.neutral[200]} gap={20} variant={BackgroundVariant.Dots} />
        <Controls
          style={{
            backgroundColor: colors.neutral[0],
            border: `1px solid ${colors.neutral[200]}`,
          }}
        />
        <MiniMap
          nodeColor={(node) => getStageTypeColor(node.data?.stageType || 'custom')}
          maskColor="rgba(0, 0, 0, 0.1)"
          style={{
            background: colors.neutral[100],
          }}
        />

        {/* Top Panel - Toolbar */}
        {!readOnly && (
          <Panel position="top-right">
            <Space>
              <Dropdown
                menu={{
                  items: stageTypeMenuItems.map((item) => ({
                    key: item.key,
                    label: item.label,
                    onClick: () => handleAddStage(item.key),
                  })),
                }}
                trigger={['click']}
              >
                <Button type="primary" icon={<PlusOutlined />}>
                  添加阶段
                </Button>
              </Dropdown>
              {selectedNodeId && (
                <Tooltip title="删除选中阶段">
                  <Button icon={<DeleteOutlined />} onClick={handleDeleteNode} danger>
                    删除
                  </Button>
                </Tooltip>
              )}
              {onSaveLayout && (
                <Tooltip title="保存布局">
                  <Button icon={<SaveOutlined />} onClick={() => {
                    const viewport = { x: 0, y: 0, zoom: 1 };
                    onSaveLayout(nodes, edges, viewport);
                    message.success('布局已保存');
                  }}>
                    保存布局
                  </Button>
                </Tooltip>
              )}
            </Space>
          </Panel>
        )}

        {/* Info Panel */}
        <Panel position="bottom-left">
          <div
            style={{
              background: colors.neutral[0],
              padding: `${spacing[2]} ${spacing[3]}`,
              borderRadius: 6,
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: spacing[3],
            }}
          >
            <Space>
              <span>阶段: {stages.length}</span>
              <span>|</span>
              <span>连线: {edges.length}</span>
            </Space>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// Wrapper with ReactFlowProvider
const PipelineCanvas: React.FC<PipelineCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default PipelineCanvas;