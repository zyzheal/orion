/**
 * ScriptVersions DiffModal
 * 抽取自 index.tsx (P2-9 Phase 187)
 */
import { Modal, Space, Select, Tabs, Empty, Typography, Tag } from 'antd';
import type { ScriptVersionDiff } from '@/api/script-versions';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;

interface DiffModalProps {
  scriptId: string;
  open: boolean;
  diffV1: string;
  diffV2: string;
  diffData: ScriptVersionDiff | null;
  versionList: string[];
  onV1Change: (v: string) => void;
  onV2Change: (v: string) => void;
  onDiff: () => void;
  onClose: () => void;
}

export const DiffModal = ({
  scriptId,
  open,
  diffV1,
  diffV2,
  diffData,
  versionList,
  onV1Change,
  onV2Change,
  onDiff,
  onClose,
}: DiffModalProps) => (
  <Modal
    title={`版本对比 — ${scriptId}`}
    open={open}
    onCancel={onClose}
    onOk={onDiff}
    okText="对比"
    width={800}
  >
    <Space.Compact style={{ marginBottom: spacing.md, width: '100%' }}>
      <Select
        placeholder="选择版本 V1"
        value={diffV1 || undefined}
        onChange={onV1Change}
        style={{ width: '45%' }}
        options={versionList.map((v) => ({ value: v, label: v }))}
        allowClear
      />
      <span style={{ lineHeight: '32px', color: colors.neutral[500] }}>vs</span>
      <Select
        placeholder="选择版本 V2"
        value={diffV2 || undefined}
        onChange={onV2Change}
        style={{ width: '45%' }}
        options={versionList.map((v) => ({ value: v, label: v }))}
        allowClear
      />
    </Space.Compact>
    {diffData && (
      <div>
        <Tabs
          items={[
            {
              key: 'summary',
              label: '概要',
              children: (
                <div>
                  <p>
                    <Text strong>Summary: </Text>
                    {diffData.summary}
                  </p>
                  <Space>
                    <Tag color="green">+{diffData.added.length} Added</Tag>
                    <Tag color="red">-{diffData.removed.length} Removed</Tag>
                    <Tag color="orange">~{diffData.modified.length} Modified</Tag>
                    <Tag color="default">={diffData.unchanged.length} Unchanged</Tag>
                  </Space>
                </div>
              ),
            },
            {
              key: 'added',
              label: `Added (${diffData.added.length})`,
              children:
                diffData.added.length > 0 ? (
                  <pre
                    style={{
                      maxHeight: 300,
                      overflow: 'auto',
                      background: colors.neutral[200],
                      padding: 12,
                    }}
                  >
                    {diffData.added.join('\n')}
                  </pre>
                ) : (
                  <Empty description="无新增行" />
                ),
            },
            {
              key: 'removed',
              label: `Removed (${diffData.removed.length})`,
              children:
                diffData.removed.length > 0 ? (
                  <pre
                    style={{
                      maxHeight: 300,
                      overflow: 'auto',
                      background: colors.neutral[200],
                      padding: 12,
                      color: colors.error[500],
                    }}
                  >
                    {diffData.removed.join('\n')}
                  </pre>
                ) : (
                  <Empty description="无删除行" />
                ),
            },
            {
              key: 'modified',
              label: `Modified (${diffData.modified.length})`,
              children:
                diffData.modified.length > 0 ? (
                  <pre
                    style={{
                      maxHeight: 300,
                      overflow: 'auto',
                      background: colors.neutral[200],
                      padding: 12,
                    }}
                  >
                    {diffData.modified.join('\n')}
                  </pre>
                ) : (
                  <Empty description="无变更行" />
                ),
            },
          ]}
        />
      </div>
    )}
  </Modal>
);
