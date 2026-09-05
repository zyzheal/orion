/**
 * Table column definitions for the ProductLine page.
 *
 * - productLineColumns  – factory that receives action handler callbacks
 * - releaseTrainColumns – static columns for the release-train detail table
 * - hotfixChannelColumns – static columns for the hotfix-channel detail table
 * - filterDefinitions   – static filter definitions for the search bar
 */
import React, { useMemo } from 'react';
import {
  Tag,
  Tooltip,
  Button,
  Popconfirm,
  Space,
  Switch,
  Text,
  type TypographyProps,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  RocketOutlined,
  FireOutlined,
} from '@ant-design/icons';
import type {
  ProductLine,
  ProductLinePhase,
  ReleaseTrain,
  HotfixChannel,
} from '@/api/product-lines';
import type { TableColumn } from '@/components/Table';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import dayjs from 'dayjs';
import {
  phaseColorMap,
  releaseTrainStateColorMap,
  branchModeLabels,
} from './config';

// ---------------------------------------------------------------------------
// Product Line columns (factory – needs action callbacks)
// ---------------------------------------------------------------------------

type ProductLineColumnActions = {
  openDetail: (pl: ProductLine) => void;
  openEdit: (pl: ProductLine) => void;
  handleActivate: (id: string) => void;
  handleSuspend: (id: string) => void;
  handleDelete: (id: string) => void;
};

export function buildProductLineColumns(
  actions: ProductLineColumnActions,
): TableColumn<ProductLine>[] {
  const { openDetail, openEdit, handleActivate, handleSuspend, handleDelete } =
    actions;

  return [
    {
      key: 'displayName',
      title: '产品线',
      dataIndex: 'displayName',
      width: 160,
      sortable: true,
      render: (v: unknown, record: ProductLine) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.name}
          </Text>
        </Space>
      ),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'description',
      width: 200,
      render: (v: unknown) => <Text type="secondary">{String(v || '-')}</Text>,
    },
    {
      key: 'branchMode',
      title: '分支模式',
      width: 110,
      render: (_: unknown, record: ProductLine) => {
        const mode = record.branchPolicies?.mode;
        return <Tag>{branchModeLabels[mode] || mode}</Tag>;
      },
    },
    {
      key: 'phase',
      title: '状态',
      width: 90,
      render: (_: unknown, record: ProductLine) => (
        <Tag
          color={phaseColorMap[record.status?.phase as ProductLinePhase] || 'default'}
        >
          {record.status?.phase || '-'}
        </Tag>
      ),
    },
    {
      key: 'stats',
      title: '流水线/部署',
      width: 130,
      render: (_: unknown, record: ProductLine) => {
        const stats = record.status?.statistics;
        if (!stats) return <Text type="secondary">-</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>共 {stats.totalPipelines || 0} 次</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              部署 {stats.totalDeployments || 0} 次
            </Text>
          </Space>
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
      width: 240,
      render: (_: unknown, record: ProductLine) => (
        <Space size="small" wrap>
          <Tooltip title="查看详情">
            <Button type="link" size="small" onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          {record.status?.phase === 'Active' ? (
            <Tooltip title="暂停">
              <Popconfirm title="确认暂停?" onConfirm={() => handleSuspend(record.id)}>
                <Button type="link" size="small" danger icon={<PauseCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          ) : record.status?.phase === 'Suspended' ||
            record.status?.phase === 'Pending' ? (
            <Tooltip title="激活">
              <Popconfirm title="确认激活?" onConfirm={() => handleActivate(record.id)}>
                <Button type="link" size="small" icon={<PlayCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          ) : null}
          <Tooltip title="删除">
            <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Filter definitions for the SearchFilterBar
// ---------------------------------------------------------------------------

export const filterDefinitions: FilterDefinition[] = [
  {
    key: 'phase',
    label: '状态',
    options: [
      { label: '全部', value: 'all' },
      { label: 'Pending', value: 'Pending' },
      { label: 'Active', value: 'Active' },
      { label: 'Suspended', value: 'Suspended' },
      { label: 'Error', value: 'Error' },
    ],
  },
  {
    key: 'branchMode',
    label: '分支模式',
    options: [
      { label: '全部', value: 'all' },
      { label: 'GitFlow', value: 'gitflow' },
      { label: 'GitHub Flow', value: 'github-flow' },
      { label: 'Trunk-Based', value: 'trunk-based' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Release Train columns (static)
// ---------------------------------------------------------------------------

export const releaseTrainColumns: TableColumn<ReleaseTrain>[] = [
  {
    key: 'name',
    title: '名称',
    dataIndex: 'name',
    width: 140,
    render: (v: unknown) => (
      <Text strong>
        <RocketOutlined /> {String(v)}
      </Text>
    ),
  },
  {
    key: 'schedule',
    title: '调度 (Cron)',
    dataIndex: 'schedule',
    width: 120,
    render: (v: unknown) => <Text code>{String(v)}</Text>,
  },
  {
    key: 'branches',
    title: '源 -> 目标',
    width: 160,
    render: (_: unknown, record: ReleaseTrain) => (
      <Text>
        <Tag>{record.sourceBranch || 'develop'}</Tag> <Text type="secondary">→</Text>{' '}
        <Tag color="blue">{record.targetBranch || 'main'}</Tag>
      </Text>
    ),
  },
  {
    key: 'state',
    title: '状态',
    width: 90,
    render: (_: unknown, record: ReleaseTrain) => (
      <Tag color={releaseTrainStateColorMap[record.status?.state] || 'default'}>
        {record.status?.state || '-'}
      </Tag>
    ),
  },
  {
    key: 'lastRelease',
    title: '上次发布',
    width: 100,
    render: (_: unknown, record: ReleaseTrain) => (
      <Text>{record.status?.lastRelease || '-'}</Text>
    ),
  },
  {
    key: 'nextRun',
    title: '下次运行',
    width: 140,
    render: (_: unknown, record: ReleaseTrain) => (
      <Text type="secondary">
        {record.status?.nextRun ? dayjs(String(record.status.nextRun)).fromNow() : '-'}
      </Text>
    ),
  },
];

// ---------------------------------------------------------------------------
// Hotfix Channel columns (static)
// ---------------------------------------------------------------------------

export const hotfixChannelColumns: TableColumn<HotfixChannel>[] = [
  {
    key: 'name',
    title: '名称',
    dataIndex: 'name',
    width: 160,
    render: (v: unknown) => (
      <Text strong>
        <FireOutlined /> {String(v)}
      </Text>
    ),
  },
  {
    key: 'branchPattern',
    title: '分支模式',
    dataIndex: 'branchPattern',
    width: 140,
    render: (v: unknown) => <Text code>{String(v)}</Text>,
  },
  {
    key: 'enabled',
    title: '启用',
    dataIndex: 'enabled',
    width: 70,
    render: (v: unknown) => <Switch checked={!!v} size="small" disabled />,
  },
  {
    key: 'approvalRequired',
    title: '需要审批',
    dataIndex: 'approvalRequired',
    width: 90,
    render: (v: unknown) => (v ? <Tag color="orange">是</Tag> : <Tag>否</Tag>),
  },
  {
    key: 'autoMerge',
    title: '自动合并',
    dataIndex: 'autoMerge',
    width: 90,
    render: (v: unknown) => (v ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
  },
  {
    key: 'activeHotfixes',
    title: '进行中',
    width: 80,
    render: (_: unknown, record: HotfixChannel) => (
      <Text>{record.status?.activeHotfixes ?? 0}</Text>
    ),
  },
  {
    key: 'maxDuration',
    title: '最大时长(分)',
    dataIndex: 'maxDuration',
    width: 100,
    render: (v: unknown) => <Text>{String(v ?? '-')}</Text>,
  },
];
