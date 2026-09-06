/**
 * DetailDrawer.tsx - 集合详情抽屉
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
import React, { useMemo } from 'react';
import { Drawer, Tabs, Descriptions, Tag, Table } from 'antd';
import dayjs from 'dayjs';
import type { VectorCollection, VectorDocument } from '@/api/vector-store';
import { indexTypeLabelMap, metricLabelMap, statusColorMap, statusLabelMap } from '../constants';
import { makeDocumentColumns } from '../columns';


interface DetailDrawerProps {
  open: boolean;
  selectedCollection: VectorCollection | null;
  collectionDocs: VectorDocument[];
  handleDeleteDoc: (id: string) => void;
  onClose: () => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  open,
  selectedCollection,
  collectionDocs,
  handleDeleteDoc,
  onClose,
}) => {
  const documentColumns = useMemo(() => makeDocumentColumns(handleDeleteDoc), [handleDeleteDoc]);

  const detailTabs = useMemo(() => {
    if (!selectedCollection) return [];
    const c = selectedCollection;
    return [
      {
        key: 'info',
        label: '基本信息',
        children: (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="集合名称">{c.name}</Descriptions.Item>
            <Descriptions.Item label="显示名称">{c.displayName}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {c.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="文档数量">
              {c.documentCount.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="向量维度">{c.dimensions}</Descriptions.Item>
            <Descriptions.Item label="索引类型">
              {indexTypeLabelMap[c.indexType] || c.indexType}
            </Descriptions.Item>
            <Descriptions.Item label="距离度量">
              {metricLabelMap[c.distanceMetric] || c.distanceMetric}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusColorMap[c.status] || 'default'}>{statusLabelMap[c.status] || c.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(c.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(c.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'documents',
        label: '文档列表',
        children: (
          <Table<VectorDocument>
            columns={documentColumns}
            dataSource={collectionDocs}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
          />
        ),
      },
    ];
  }, [selectedCollection, collectionDocs, documentColumns]);

  return (
    <Drawer
      title={selectedCollection ? `${selectedCollection.displayName} - 集合详情` : '集合详情'}
      open={open}
      onClose={onClose}
      width={800}
      destroyOnClose
    >
      <Tabs items={detailTabs} />
    </Drawer>
  );
};
