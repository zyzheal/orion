/**
 * 工作流画布
 *
 * 可视化节点编辑和连线
 */
import React, { useEffect, useState } from 'react';
import { Button, Empty, Space, Tag, Typography, message } from 'antd';
import {
  PlayCircleOutlined,
  SaveOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { getWorkflow, executeWorkflow, WorkflowDefinition } from '@/api/workflow';
import { colors } from '@/tokens';

const { Text } = Typography;

interface WorkflowCanvasProps {
  workflowId: string | null;
}

const nodeTypeColors: Record<string, string> = {
  start: colors.success[500],
  approval: colors.purple[500],
  condition: colors.warning[500],
  notification: colors.info[500],
  webhook: colors.primary[500],
  end: colors.neutral[500],
};

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ workflowId }) => {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!workflowId) {
      setWorkflow(null);
      return;
    }
    setLoading(true);
    getWorkflow(workflowId)
      .then(setWorkflow)
      .catch(() => message.error('获取工作流失败'))
      .finally(() => setLoading(false));
  }, [workflowId]);

  const handleExecute = async () => {
    if (!workflowId) return;
    try {
      await executeWorkflow(workflowId, { triggeredBy: 'user' });
      message.success('工作流已触发执行');
    } catch {
      message.error('执行失败');
    }
  };

  if (!workflowId) {
    return (
      <div style={{ padding: 48 }}>
        <Empty description="请先选择一个工作流" />
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}>加载中...</div>;
  }

  if (!workflow) {
    return (
      <div style={{ padding: 48 }}>
        <Empty description="工作流不存在" />
      </div>
    );
  }

  return (
    <div style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.neutral[200]}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Space>
          <Text strong>{workflow.name}</Text>
          <Tag>v{workflow.version}</Tag>
          {workflow.enabled ? (
            <Tag color={colors.success[500]}>已启用</Tag>
          ) : (
            <Tag color={colors.warning[500]}>已暂停</Tag>
          )}
        </Space>
        <Space>
          <Button
            icon={<ZoomOutOutlined />}
            size="small"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
          />
          <Text style={{ fontSize: 12 }}>{Math.round(zoom * 100)}%</Text>
          <Button
            icon={<ZoomInOutlined />}
            size="small"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
          />
          <Button icon={<SaveOutlined />} size="small">
            保存
          </Button>
          <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={handleExecute}>
            执行
          </Button>
        </Space>
      </div>

      {/* Canvas area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#F5F5F7',
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            padding: 24,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {workflow.nodes?.map((node) => (
            <div
              key={node.id}
              style={{
                width: 180,
                minHeight: 80,
                background: '#fff',
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                borderLeft: `3px solid ${nodeTypeColors[node.type] || colors.neutral[400]}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{node.name}</div>
              <Tag color={nodeTypeColors[node.type]} style={{ fontSize: 10 }}>
                {node.type}
              </Tag>
            </div>
          ))}
          {(!workflow.nodes || workflow.nodes.length === 0) && (
            <Empty description="暂无节点，请从左侧节点面板拖拽添加" />
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;
