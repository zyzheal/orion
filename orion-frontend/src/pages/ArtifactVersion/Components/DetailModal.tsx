/**
 * DetailModal - 版本详情与追溯链
 * 抽取自 index.tsx (P2-9 Phase 210)
 */
import { Modal, Descriptions, Timeline, Divider, Typography } from 'antd';
import type { ArtifactVersion, TraceabilityChain } from '@/api/artifactVersions';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Text } = Typography;

interface Props {
  open: boolean;
  selectedVersion: ArtifactVersion | null;
  chain: TraceabilityChain | null;
  onClose: () => void;
}

export const DetailModal = ({ open, selectedVersion, chain, onClose }: Props) => (
  <Modal
    title="版本详情与追溯链"
    open={open}
    onCancel={onClose}
    footer={null}
    width={700}
  >
    {selectedVersion && chain && (
      <>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Artifact">{selectedVersion.artifactName}</Descriptions.Item>
          <Descriptions.Item label="版本">{selectedVersion.version}</Descriptions.Item>
          <Descriptions.Item label="分支">{selectedVersion.branch || '-'}</Descriptions.Item>
          <Descriptions.Item label="Commit">
            {selectedVersion.commitSha ? selectedVersion.commitSha.slice(0, 7) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Stage">{selectedVersion.stageName}</Descriptions.Item>
          <Descriptions.Item label="Pipeline">{selectedVersion.pipelineId}</Descriptions.Item>
        </Descriptions>

        <Divider />
        <Text strong>追溯链</Text>

        {chain.pipelineRun && (
          <Timeline style={{ marginTop: spacing.md }}>
            <Timeline.Item color="blue">
              <Text strong>构建完成</Text>
              <br />
              <Text type="secondary">
                {dayjs(chain.pipelineRun.startedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </Timeline.Item>
            {chain.deployments?.map((d, i) => (
              <Timeline.Item key={String(i)} color="green">
                <Text strong>部署到 {d.environment}</Text>
                <br />
                <Text type="secondary">
                  {d.status} · {dayjs(d.deployedAt).format('YYYY-MM-DD HH:mm:ss')}
                  {d.deployedBy ? ` by ${d.deployedBy}` : ''}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}

        <Divider />
        <Text strong>存储路径</Text>
        <div style={{ marginTop: spacing.sm }}>
          <Text code>{selectedVersion.storagePath}</Text>
        </div>
      </>
    )}
    {selectedVersion && !chain && <Text type="secondary">加载追溯链中...</Text>}
  </Modal>
);
