/**
 * FlowImportExport Export Card
 * 抽取自 index.tsx (P2-9 Phase 138)
 */
import React from 'react';
import { Card, Button, Space, Select, Typography } from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { LowcodeFlow } from '@/api/lowcode';

const { Option } = Select;

interface ExportCardProps {
  flows: LowcodeFlow[];
  loading: boolean;
  exporting: boolean;
  selectedFlow: LowcodeFlow | null;
  setSelectedFlow: (flow: LowcodeFlow | null) => void;
  handleExport: (flow: LowcodeFlow) => void;
  loadFlows: () => void;
}

export const ExportCard: React.FC<ExportCardProps> = ({
  flows,
  loading,
  exporting,
  selectedFlow,
  setSelectedFlow,
  handleExport,
  loadFlows,
}) => (
  <Card
    title="导出流程"
    style={{ height: '100%' }}
    extra={
      <Button icon={<ReloadOutlined />} size="small" onClick={loadFlows}>
        刷新
      </Button>
    }
  >
    <Typography.Text
      type="secondary"
      style={{ display: 'block', marginBottom: spacing.md }}
    >
      选择流程并导出为 JSON 文件，可用于备份或迁移
    </Typography.Text>
    <Select
      placeholder="选择要导出的流程"
      style={{ width: '100%', marginBottom: spacing.sm }}
      value={selectedFlow?.id}
      onChange={(id) => {
        const flow = flows.find((f) => f.id === id) || null;
        setSelectedFlow(flow);
      }}
      showSearch
      optionFilterProp="children"
      loading={loading}
    >
      {flows.map((flow) => (
        <Option key={flow.id} value={flow.id}>
          {flow.name} (v{flow.version})
        </Option>
      ))}
    </Select>
    <Space direction="vertical" style={{ width: '100%' }}>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        block
        loading={exporting}
        disabled={!selectedFlow}
        onClick={() => selectedFlow && handleExport(selectedFlow)}
      >
        导出完整版（含版本历史）
      </Button>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        完整版包含流程定义 + 完整版本历史记录
      </Typography.Text>
    </Space>
  </Card>
);
