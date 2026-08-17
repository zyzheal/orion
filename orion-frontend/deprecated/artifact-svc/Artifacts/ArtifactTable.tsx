/**
 * Artifact Table - Artifact list table with action buttons
 */
import React from 'react';
import { Tag, Space, Button, Popconfirm, Tooltip, Typography } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  TagOutlined,
  RocketOutlined,
  StopOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import type { Artifact, ArtifactStage, ArtifactStatus } from '@/api/artifacts';
import {
  stageColorMap,
  stageLabelMap,
  statusColorMap,
  typeLabelMap,
  formatSize,
  promotionStageOrder,
} from './constants';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ArtifactTableProps {
  dataSource: Artifact[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  onDetail: (record: Artifact) => void;
  onEdit: (record: Artifact) => void;
  onPromote: (record: Artifact) => void;
  onTag: (record: Artifact) => void;
  onDownload: (record: Artifact) => void;
  onDeprecate: (id: string) => void;
  onQuarantine: (id: string) => void;
  onDelete: (id: string) => void;
  onPaginationChange: (page: number, size: number) => void;
}

const ArtifactTable: React.FC<ArtifactTableProps> = ({
  dataSource,
  loading,
  currentPage,
  pageSize,
  total,
  onDetail,
  onEdit,
  onPromote,
  onTag,
  onDownload,
  onDeprecate,
  onQuarantine,
  onDelete,
  onPaginationChange,
}) => {
  const nextAvailableStage = (currentStage: ArtifactStage): ArtifactStage | null => {
    const idx = promotionStageOrder.indexOf(currentStage);
    if (idx < 0 || idx >= promotionStageOrder.length - 1) return null;
    return promotionStageOrder[idx + 1];
  };

  const columns: TableColumn<Artifact>[] = [
    {
      key: 'name',
      title: '制品名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (v: unknown, record: Artifact) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => onDetail(record)}>
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.displayName || record.namespace}/{record.version}
          </Text>
        </Space>
      ),
    },
    {
      key: 'type',
      title: '类型',
      width: 120,
      render: (_: unknown, record: Artifact) => (
        <Tag>{typeLabelMap[record.type] || record.type}</Tag>
      ),
    },
    {
      key: 'stage',
      title: '阶段',
      width: 110,
      render: (_: unknown, record: Artifact) => (
        <Tag color={stageColorMap[record.stage as ArtifactStage] || 'default'}>
          {stageLabelMap[record.stage as ArtifactStage] || record.stage}
        </Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: Artifact) => (
        <Tag color={statusColorMap[record.status as ArtifactStatus] || 'default'}>
          {record.status}
        </Tag>
      ),
    },
    {
      key: 'size',
      title: '大小',
      width: 90,
      render: (_: unknown, record: Artifact) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatSize(record.sizeBytes || 0)}
        </Text>
      ),
    },
    {
      key: 'security',
      title: '安全评分',
      width: 100,
      render: (_: unknown, record: Artifact) => {
        const scan = record.security?.scanResults;
        if (!scan) return <Text type="secondary">-</Text>;
        const total = scan.critical + scan.high + scan.medium + scan.low;
        const score =
          total === 0
            ? 100
            : Math.max(
                0,
                100 - scan.critical * 20 - scan.high * 10 - scan.medium * 3 - scan.low * 1
              );
        return (
          <Tag color={score >= 90 ? 'green' : score >= 70 ? 'orange' : 'red'}>
            <SafetyCertificateOutlined /> {score}
          </Tag>
        );
      },
    },
    {
      key: 'updatedAt',
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 140,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 260,
      render: (_: unknown, record: Artifact) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          {record.status === 'available' && nextAvailableStage(record.stage) && (
            <Tooltip title={`晋升到 ${stageLabelMap[nextAvailableStage(record.stage)!]}`}>
              <Button
                type="link"
                size="small"
                icon={<RocketOutlined />}
                onClick={() => onPromote(record)}
              />
            </Tooltip>
          )}
          {record.status === 'available' && (
            <Tooltip title="管理标签">
              <Button
                type="link"
                size="small"
                icon={<TagOutlined />}
                onClick={() => onTag(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="下载">
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => onDownload(record)}
            />
          </Tooltip>
          {record.status === 'available' && (
            <>
              <Tooltip title="废弃">
                <Popconfirm title="确认废弃该制品?" onConfirm={() => onDeprecate(record.id)}>
                  <Button type="link" size="small" danger icon={<StopOutlined />} />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="隔离">
                <Popconfirm title="确认隔离该制品?" onConfirm={() => onQuarantine(record.id)}>
                  <Button type="link" size="small" danger icon={<StopOutlined />}>
                    隔离
                  </Button>
                </Popconfirm>
              </Tooltip>
            </>
          )}
          <Tooltip title="删除">
            <Popconfirm title="确认删除?" onConfirm={() => onDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
      clientPagination={false}
      pagination={{ current: currentPage, pageSize, total }}
      onPaginationChange={onPaginationChange}
    />
  );
};

export default ArtifactTable;
