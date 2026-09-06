/**
 * DeveloperPortal Table Columns — 5 column factories extracted from DeveloperPortalPage.tsx
 *
 * Each column array is exposed as a factory hook that accepts handler callbacks,
 * keeping the columns reactive to state changes in the parent component.
 */
import { useMemo } from 'react';
import { Tag, Badge, Typography, Space, Button, Tooltip, Popconfirm, Switch } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  SendOutlined,
  HistoryOutlined,
  SyncOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type {
  PortalDocument,
  MockRule,
  SDKGenerationTask,
  APISubscription,
  PlaygroundRequest,
} from '@/api/developer-portal';
import { documentTypeConfig, statusConfig, subscriptionStatusMap, sdkStatusMap } from './config';
import { httpMethodColorMap } from './constants';

const { Text } = Typography;

// ---- Document Columns ----

interface DocColumnsProps {
  onDocDetail: (doc: PortalDocument) => void;
  onDocEdit: (doc: PortalDocument) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
}

export function useDocColumns(props: DocColumnsProps): ColumnsType<PortalDocument> {
  const { onDocDetail, onDocEdit, onPublish, onUnpublish, onDelete } = props;
  return useMemo((): ColumnsType<PortalDocument> => [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      render: (text: string, record: PortalDocument) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => onDocDetail(record)}
          >
            {documentTypeConfig[record.documentType]?.icon}
            <span style={{ marginLeft: 6 }}>{text}</span>
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.slug}
          </Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'documentType',
      key: 'documentType',
      width: 100,
      render: (type: string) => {
        const cfg = documentTypeConfig[type] || { label: type, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'published',
      key: 'published',
      width: 90,
      render: (published: boolean) => {
        const cfg = published ? statusConfig.published : statusConfig.draft;
        return <Badge status={published ? 'success' : 'default'} text={cfg.label} />;
      },
    },
    {
      title: '浏览',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 70,
      render: (n: number) => n || 0,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: PortalDocument) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onDocDetail(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onDocEdit(record)}
            />
          </Tooltip>
          {record.published ? (
            <Tooltip title="取消发布">
              <Button type="link" size="small" onClick={() => onUnpublish(record.id)}>
                下架
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="发布">
              <Button type="link" size="small" onClick={() => onPublish(record.id)}>
                发布
              </Button>
            </Tooltip>
          )}
          <Popconfirm title="确认删除此文档？" onConfirm={() => onDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [onDocDetail, onDocEdit, onPublish, onUnpublish, onDelete]);
}

// ---- Mock Columns ----

interface MockColumnsProps {
  onToggle: (id: string) => void;
  onEdit: (rule: MockRule) => void;
  onDelete: (id: string) => void;
}

export function useMockColumns(props: MockColumnsProps): ColumnsType<MockRule> {
  const { onToggle, onEdit, onDelete } = props;
  return useMemo((): ColumnsType<MockRule> => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: MockRule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (m: string) => <Tag color={httpMethodColorMap[m] || 'default'}>{m}</Tag>,
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 200,
      render: (p: string) => <Text code>{p}</Text>,
    },
    {
      title: '匹配类型',
      dataIndex: 'matchType',
      key: 'matchType',
      width: 100,
      render: (t: string) => <Tag>{t === 'exact' ? '精确' : t === 'prefix' ? '前缀' : '正则'}</Tag>,
    },
    {
      title: '状态码',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 80,
      render: (code: number) => (
        <Tag color={code < 300 ? 'green' : code < 400 ? 'blue' : code < 500 ? 'orange' : 'red'}>
          {code}
        </Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: MockRule) => (
        <Switch checked={enabled} size="small" onChange={() => onToggle(record.id)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: MockRule) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            />
          </Tooltip>
          <Popconfirm title="确认删除此规则？" onConfirm={() => onDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [onToggle, onEdit, onDelete]);
}

// ---- SDK Columns ----

interface SdkColumnsProps {
  onDetail: (task: SDKGenerationTask) => void;
  onRegenerate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function useSdkColumns(props: SdkColumnsProps): ColumnsType<SDKGenerationTask> {
  const { onDetail, onRegenerate, onDelete } = props;
  return useMemo((): ColumnsType<SDKGenerationTask> => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '语言',
      dataIndex: 'language',
      key: 'language',
      width: 120,
      render: (lang: string) => <Tag color="blue">{lang}</Tag>,
    },
    {
      title: '包名',
      dataIndex: 'packageName',
      key: 'packageName',
      width: 200,
      render: (n: string) => <Text code>{n}</Text>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = sdkStatusMap[status] || sdkStatusMap.pending;
        return (
          <Tag icon={cfg.icon} color={cfg.color}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: SDKGenerationTask) => (
        <Space size="small">
          <Tooltip title="查看代码">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onDetail(record)}
            />
          </Tooltip>
          {record.status === 'failed' && (
            <Tooltip title="重新生成">
              <Button
                type="link"
                size="small"
                icon={<SyncOutlined />}
                onClick={() => onRegenerate(record.id)}
              />
            </Tooltip>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => onDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [onDetail, onRegenerate, onDelete]);
}

// ---- Subscription Columns ----

interface SubColumnsProps {
  onDetail: (sub: APISubscription) => void;
  onApprove: (id: string) => void;
  onReject: (sub: APISubscription) => void;
  onSuspend: (id: string) => void;
  onCancel: (id: string) => void;
  onCopyKey: (key: string) => void;
}

export function useSubColumns(props: SubColumnsProps): ColumnsType<APISubscription> {
  const { onDetail, onApprove, onReject, onSuspend, onCancel, onCopyKey } = props;
  return useMemo((): ColumnsType<APISubscription> => [
    {
      title: 'API 名称',
      dataIndex: 'apiName',
      key: 'apiName',
      width: 200,
      render: (name: string, record: APISubscription) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => onDetail(record)}
          >
            {name}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.planName}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = subscriptionStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '日用量',
      key: 'dailyUsage',
      width: 120,
      render: (_: unknown, record: APISubscription) => (
        <Text>
          {record.usedToday} / {record.quotaPerDay}
        </Text>
      ),
    },
    {
      title: '月用量',
      key: 'monthlyUsage',
      width: 120,
      render: (_: unknown, record: APISubscription) => (
        <Text>
          {record.usedThisMonth} / {record.quotaPerMonth}
        </Text>
      ),
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      width: 160,
      render: (key: string) => (
        <Space>
          <Text code style={{ fontSize: 11 }}>
            {key?.substring(0, 16)}...
          </Text>
          <Tooltip title="复制">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => onCopyKey(key)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: APISubscription) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onDetail(record)}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" onClick={() => onApprove(record.id)}>
                批准
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => onReject(record)}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <>
              <Popconfirm title="确认暂停？" onConfirm={() => onSuspend(record.id)}>
                <Button type="link" size="small">
                  暂停
                </Button>
              </Popconfirm>
              <Popconfirm title="确认取消？" onConfirm={() => onCancel(record.id)}>
                <Button type="link" size="small" danger>
                  取消
                </Button>
              </Popconfirm>
            </>
          )}
          {(record.status === 'suspended' || record.status === 'rejected') && (
            <Popconfirm title="确认取消？" onConfirm={() => onCancel(record.id)}>
              <Button type="link" size="small" danger>
                取消
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [onDetail, onApprove, onReject, onSuspend, onCancel, onCopyKey]);
}

// ---- Playground Columns ----

interface PgColumnsProps {
  onLoad: (req: PlaygroundRequest) => void;
  onReplay: (id: string) => void;
  onHistory: (id: string) => void;
  onDelete: (id: string) => void;
}

export function usePgColumns(props: PgColumnsProps): ColumnsType<PlaygroundRequest> {
  const { onLoad, onReplay, onHistory, onDelete } = props;
  return useMemo((): ColumnsType<PlaygroundRequest> => [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (m: string) => <Tag color={httpMethodColorMap[m] || 'default'}>{m}</Tag>,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 300,
      ellipsis: true,
      render: (url: string) => <Text code>{url}</Text>,
    },
    {
      title: 'Body 类型',
      dataIndex: 'bodyType',
      key: 'bodyType',
      width: 90,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: PlaygroundRequest) => (
        <Space size="small">
          <Tooltip title="加载到表单">
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => onLoad(record)}
            />
          </Tooltip>
          <Tooltip title="重放">
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => onReplay(record.id)}
            />
          </Tooltip>
          <Tooltip title="响应历史">
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => onHistory(record.id)}
            />
          </Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => onDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [onLoad, onReplay, onHistory, onDelete]);
}
