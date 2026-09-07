/**
 * FlowVersions FlowSelector
 * 抽取自 index.tsx (P2-9 Phase 184)
 */
import { Card, Button, Tag, Descriptions, Typography, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { LowcodeFlow } from '@/api/lowcode';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface FlowSelectorProps {
  flows: LowcodeFlow[];
  selectedFlow: LowcodeFlow | null;
  loading: boolean;
  onSelect: (flow: LowcodeFlow) => void;
  onRefresh: () => void;
}

export const FlowSelector = ({ flows, selectedFlow, loading, onSelect, onRefresh }: FlowSelectorProps) => (
  <Card style={{ marginBottom: spacing.md }} styles={{ body: { paddingBottom: 12 } }}>
    <div style={{ marginBottom: 12 }}>
      <Text strong style={{ marginRight: 12 }}>选择流程：</Text>
      <Select
        placeholder="请选择要管理版本的流程"
        style={{ width: 400 }}
        value={selectedFlow?.id}
        onChange={(id) => {
          const flow = flows.find((f) => f.id === id);
          if (flow) onSelect(flow);
        }}
        showSearch
        optionFilterProp="children"
        loading={loading}
        notFoundContent={loading ? '加载中...' : '暂无流程'}
      >
        {flows.map((flow) => (
          <Option key={flow.id} value={flow.id}>
            {flow.name} (v{flow.version})
          </Option>
        ))}
      </Select>
      <Button icon={<ReloadOutlined />} style={{ marginLeft: 8 }} onClick={onRefresh}>
        刷新
      </Button>
    </div>

    {selectedFlow && (
      <Descriptions size="small" column={3} bordered style={{ borderRadius: 8 }}>
        <Descriptions.Item label="流程ID">{selectedFlow.id}</Descriptions.Item>
        <Descriptions.Item label="流程名称">{selectedFlow.name}</Descriptions.Item>
        <Descriptions.Item label="当前版本">{selectedFlow.version}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={selectedFlow.status === 'published' ? 'green' : 'orange'}>
            {selectedFlow.status === 'published' ? '已启用' : '已禁用'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建人">{selectedFlow.createdBy || 'system'}</Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {dayjs(selectedFlow.updatedAt || selectedFlow.createdAt).format('YYYY-MM-DD HH:mm')}
        </Descriptions.Item>
      </Descriptions>
    )}
  </Card>
);
