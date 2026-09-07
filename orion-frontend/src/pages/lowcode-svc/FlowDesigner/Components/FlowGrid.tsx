/**
 * FlowDesigner FlowGrid
 * 抽取自 index.tsx (P2-9 Phase 190)
 */
import { Button, Card, Empty, Input, Space } from 'antd';
import {
  EyeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import type { LowcodeFlow } from '@/api/lowcode';

interface FlowGridProps {
  flows: LowcodeFlow[];
  loading: boolean;
  onSearch: () => void;
  onAiGenerate: () => void;
  onCreate: () => void;
  onViewDetail: (flow: LowcodeFlow) => void;
  onExecute: (flow: LowcodeFlow) => void;
  onPublish: (flow: LowcodeFlow) => void;
  onDelete: (flow: LowcodeFlow) => void;
}

export const FlowGrid = ({
  flows,
  loading,
  onSearch,
  onAiGenerate,
  onCreate,
  onViewDetail,
  onExecute,
  onPublish,
  onDelete,
}: FlowGridProps) => (
  <Card>
    <div
      style={{
        marginBottom: spacing.md,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Input.Search
        placeholder="搜索流程..."
        style={{ width: 300 }}
        onSearch={onSearch}
        disabled={loading}
      />
      <Space>
        <Button icon={<ThunderboltOutlined />} onClick={onAiGenerate}>
          AI 生成
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建流程
        </Button>
      </Space>
    </div>

    {loading ? (
      <div style={{ textAlign: 'center', padding: '40px 0', color: colors.neutral[500] }}>
        加载中...
      </div>
    ) : flows.length === 0 ? (
      <Empty description="暂无流程，点击右上角新建或 AI 生成">
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={onAiGenerate}>
            AI 生成
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建流程
          </Button>
        </Space>
      </Empty>
    ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: spacing.md,
        }}
      >
        {flows.map((flow) => (
          <Card
            key={flow.id}
            hoverable
            size="small"
            style={{ borderRadius: 8 }}
            title={flow.name}
            extra={
              <Space>
                <Button size="small" icon={<EyeOutlined />} onClick={() => onViewDetail(flow)}>
                  查看
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => onExecute(flow)}
                >
                  执行
                </Button>
              </Space>
            }
            actions={[
              <Button type="link" size="small" onClick={() => onPublish(flow)}>
                发布
              </Button>,
              <Button type="link" size="small" danger onClick={() => onDelete(flow)}>
                删除
              </Button>,
            ]}
          >
            <p style={{ color: colors.neutral[500], fontSize: 14 }}>
              {flow.description || '无描述'}
            </p>
            <p style={{ fontSize: 12, color: colors.neutral[400] }}>
              节点数: {flow.nodeCount || 0} | 版本: {flow.version} | 状态: {flow.status}
            </p>
          </Card>
        ))}
      </div>
    )}
  </Card>
);
