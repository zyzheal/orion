import { Collapse, Typography } from 'antd';
import { ImportOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { DataSourcePanel } from '../DataSourcePanel';
import { ActionPanel } from '../ActionPanel';
import type { SourceSamples } from '../types';

const { Text } = Typography;

interface Props {
  importSource: SourceSamples;
  setImportSource: (v: SourceSamples) => void;
  ingesting: boolean;
  handleIngest: () => void;
  actionPrompt: string;
  setActionPrompt: (v: string) => void;
  actionTitle: string;
  setActionTitle: (v: string) => void;
  actionLoading: boolean;
  actionResult: any;
  handleAction: (kind?: string) => void | Promise<void>;
}

export function Extras({
  importSource,
  setImportSource,
  ingesting,
  handleIngest,
  actionPrompt,
  setActionPrompt,
  actionTitle,
  setActionTitle,
  actionLoading,
  actionResult,
  handleAction,
}: Props) {
  return (
    <div style={{ marginTop: spacing.md }}>
      <Collapse
        ghost
        items={[
          {
            key: 'ingest',
            label: (
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                <ImportOutlined /> 数据源接通演示 — 把告警/工单/变更/事件推入知识库，供助手检索
              </Text>
            ),
            children: (
              <DataSourcePanel
                importSource={importSource}
                setImportSource={setImportSource}
                ingesting={ingesting}
                handleIngest={handleIngest}
              />
            ),
          },
          {
            key: 'actions',
            label: (
              <Text type="secondary" style={{ fontSize: spacing[3] }}>
                <ThunderboltOutlined /> 智能操作 — 触发研发流程 Agent / AI 生成流程 / Ops 问答助手
              </Text>
            ),
            children: (
              <ActionPanel
                actionPrompt={actionPrompt}
                setActionPrompt={setActionPrompt}
                actionTitle={actionTitle}
                setActionTitle={setActionTitle}
                actionLoading={actionLoading}
                actionResult={actionResult}
                handleAction={handleAction}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
