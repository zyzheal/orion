/**
 * FlowDesigner FlowDetailModal
 * 抽取自 index.tsx (P2-9 Phase 190)
 */
import { Button, Descriptions, Modal } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { themeVars } from '@/tokens';
import type { LowcodeFlow } from '@/api/lowcode';

interface FlowDetailModalProps {
  open: boolean;
  flow: LowcodeFlow | null;
  onClose: () => void;
  onExecute: () => void;
}

export const FlowDetailModal = ({ open, flow, onClose, onExecute }: FlowDetailModalProps) => (
  <Modal
    title={`流程详情: ${flow?.name}`}
    open={open}
    onCancel={onClose}
    footer={[
      <Button key="close" onClick={onClose}>
        关闭
      </Button>,
      <Button key="execute" type="primary" icon={<PlayCircleOutlined />} onClick={onExecute}>
        执行流程
      </Button>,
    ]}
    width={700}
  >
    {flow && (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="流程ID">{flow.id}</Descriptions.Item>
        <Descriptions.Item label="流程名称">{flow.name}</Descriptions.Item>
        <Descriptions.Item label="描述">{flow.description || '无'}</Descriptions.Item>
        <Descriptions.Item label="版本">{flow.version}</Descriptions.Item>
        <Descriptions.Item label="状态">{flow.status}</Descriptions.Item>
        <Descriptions.Item label="节点数">{flow.nodeCount || 0}</Descriptions.Item>
        <Descriptions.Item label="创建人">{flow.created_by || 'system'}</Descriptions.Item>
        <Descriptions.Item label="创建时间">{flow.created_at}</Descriptions.Item>
        <Descriptions.Item label="更新时间">{flow.updated_at}</Descriptions.Item>
        <Descriptions.Item label="节点定义">
          <pre
            style={{
              maxHeight: 200,
              overflow: 'auto',
              background: themeVars.bgTertiary,
              padding: 8,
              borderRadius: 4,
            }}
          >
            {JSON.stringify(flow.nodes, null, 2)}
          </pre>
        </Descriptions.Item>
        <Descriptions.Item label="连线定义">
          <pre
            style={{
              maxHeight: 200,
              overflow: 'auto',
              background: themeVars.bgTertiary,
              padding: 8,
              borderRadius: 4,
            }}
          >
            {JSON.stringify(flow.edges, null, 2)}
          </pre>
        </Descriptions.Item>
      </Descriptions>
    )}
  </Modal>
);
