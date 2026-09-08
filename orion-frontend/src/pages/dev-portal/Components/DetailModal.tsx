/**
 * DetailModal.tsx - 组件详情弹窗
 * 抽取自 index.tsx (P2-9 Phase 241)
 */
import { Modal, Button, Descriptions, Tag, Progress, Space, } from 'antd';
import { GithubOutlined, TeamOutlined } from '@ant-design/icons';
import type { ServiceComponent } from '../useDevPortalState';

const { Item: DescItem } = Descriptions;

interface Props {
  selected: ServiceComponent | null;
  open: boolean;
  onClose: () => void;
  onOpenRepo: (c: ServiceComponent) => void;
}

export function DetailModal({ selected, open, onClose, onOpenRepo }: Props) {
  return (
    <Modal
      title={selected?.name || ''}
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="repo" icon={<GithubOutlined />} onClick={() => selected && onOpenRepo(selected)}>打开仓库</Button>,
        <Button key="close" onClick={onClose}>关闭</Button>,
      ]}
    >
      {selected && (
        <Descriptions size="small" bordered column={2}>
          <DescItem label="类型"><Tag>{selected.type}</Tag></DescItem>
          <DescItem label="生命周期">
            <Tag color={selected.lifecycle === 'production' ? 'green' : selected.lifecycle === 'experimental' ? 'orange' : 'red'}>
              {selected.lifecycle}
            </Tag>
          </DescItem>
          <DescItem label="拥有团队"><Space><TeamOutlined /> {selected.owner}</Space></DescItem>
          <DescItem label="语言"><Tag>{selected.language}</Tag></DescItem>
          <DescItem label="仓库" span={2}><Space><GithubOutlined /> {selected.repo}</Space></DescItem>
          <DescItem label="健康度" span={2}>
            <Progress percent={selected.health} format={() => `${selected.health}%`} />
          </DescItem>
          <DescItem label="技术文档" span={2}>
            {selected.techDocs ? <Tag color="green">已发布</Tag> : <Tag>未发布</Tag>}
          </DescItem>
          <DescItem label="最后部署">{selected.lastDeployed}</DescItem>
        </Descriptions>
      )}
    </Modal>
  );
}
