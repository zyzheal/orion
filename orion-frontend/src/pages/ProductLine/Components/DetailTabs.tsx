/**
 * DetailTabs.tsx - 产品线详情抽屉 Tab 内容
 * 抽取自 ProductLine/index.tsx (P2-9 Phase 95)
 */
import { useMemo } from 'react';
import { Button, Tag, Descriptions, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import { spacing } from '@/tokens';
import type { ProductLine, ProductLinePhase, ReleaseTrain, HotfixChannel } from '@/api/product-lines';
import { phaseColorMap } from '../config';
import { releaseTrainColumns, hotfixChannelColumns } from '../columns';

const { Text } = Typography;

interface DetailTabsProps {
  selectedPL: ProductLine | null;
  releaseTrains: ReleaseTrain[];
  hotfixChannels: HotfixChannel[];
  onOpenRtModal: () => void;
  onOpenHfModal: () => void;
}

export const useDetailTabs = (props: DetailTabsProps) => {
  const {
    selectedPL,
    releaseTrains,
    hotfixChannels,
    onOpenRtModal,
    onOpenHfModal,
  } = props;
  const items = useMemo(
    () => [
      {
        key: 'info',
        label: '基本信息',
        children: selectedPL ? (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="名称">{selectedPL.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{selectedPL.displayName}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedPL.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Git 仓库" span={2}>
              <Text code>{selectedPL.gitRepo?.url}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Provider">{selectedPL.gitRepo?.provider}</Descriptions.Item>
            <Descriptions.Item label="默认分支">
              {selectedPL.gitRepo?.defaultBranch}
            </Descriptions.Item>
            <Descriptions.Item label="分支模式">
              {selectedPL.branchPolicies?.mode}
            </Descriptions.Item>
            <Descriptions.Item label="默认环境">
              {selectedPL.environmentMappings?.defaultEnvironment}
            </Descriptions.Item>
            <Descriptions.Item label="环境映射数">
              {selectedPL.environmentMappings?.mappings?.length || 0}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={phaseColorMap[selectedPL.status?.phase as ProductLinePhase]}>
                {selectedPL.status?.phase}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null,
      },
      {
        key: 'release-trains',
        label: '发布列车',
        children: (
          <div>
            <div
              style={{
                marginBottom: spacing[3],
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Text type="secondary">管理定时发布列车</Text>
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onOpenRtModal}>
                创建发布列车
              </Button>
            </div>
            <Table
              columns={releaseTrainColumns}
              dataSource={releaseTrains}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        ),
      },
      {
        key: 'hotfix-channels',
        label: 'Hotfix 通道',
        children: (
          <div>
            <div
              style={{
                marginBottom: spacing[3],
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <Text type="secondary">管理紧急修复通道</Text>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                danger
                onClick={onOpenHfModal}
              >
                创建 Hotfix 通道
              </Button>
            </div>
            <Table
              columns={hotfixChannelColumns}
              dataSource={hotfixChannels}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </div>
        ),
      },
    ],
    [selectedPL, releaseTrains, hotfixChannels, onOpenRtModal, onOpenHfModal]
  );

  return { items };
};
