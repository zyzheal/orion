/**
 * PromptCanary DetailModal
 * 抽取自 index.tsx (P2-9 Phase 183)
 */
import { Modal, Descriptions, Table, Empty, Tag } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PromptCanaryStatus, PromptVersionInfo } from '../types';
import { spacing } from '@/tokens';

interface DetailModalProps {
  open: boolean;
  selected: PromptCanaryStatus | null;
  columns: ColumnsType<PromptVersionInfo>;
  onClose: () => void;
}

export const DetailModal = ({ open, selected, columns, onClose }: DetailModalProps) =>
  selected && (
    <Modal
      title={
        <span>
          <CodeOutlined />
          {' Prompt 详情: '}
          {selected.name}
        </span>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
        <Descriptions.Item label="Prompt 名称">{selected.name}</Descriptions.Item>
        <Descriptions.Item label="Active 版本">
          <Tag color="green">v{selected.active_version}</Tag>
        </Descriptions.Item>
        {selected.canary_version && (
          <Descriptions.Item label="Canary 版本">
            <Tag color="orange">
              v{selected.canary_version} ({selected.traffic_percent}%)
            </Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="版本总数">{selected.versions?.length || 0}</Descriptions.Item>
      </Descriptions>

      {selected.versions && selected.versions.length > 0 ? (
        <Table
          dataSource={selected.versions}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      ) : (
        <Empty description="暂无版本" />
      )}
    </Modal>
  );
