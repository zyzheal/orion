/**
 * columns.tsx - APK 上传历史 表格列
 * 抽取自 index.tsx (P2-9 Phase 215)
 */
import { Tag } from 'antd';
import { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { MARKET_NAMES, STATUS_CONFIG, type ApkUploadRecord } from '@/api/apk-upload-history';

dayjs.extend(relativeTime);

export function buildApkUploadColumns(): ColumnsType<ApkUploadRecord> {
  return [
    {
      title: '应用市场',
      dataIndex: 'market',
      key: 'market',
      render: (market: string) => <Tag color="blue">{MARKET_NAMES[market] || market}</Tag>,
    },
    {
      title: '包名',
      dataIndex: 'packageName',
      key: 'packageName',
      render: (pkg: string) => <code>{pkg}</code>,
    },
    {
      title: '版本',
      dataIndex: 'versionName',
      key: 'versionName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ApkUploadRecord['status']) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '上传地址',
      dataIndex: 'uploadUrl',
      key: 'uploadUrl',
      render: (url: string) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            查看
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (ms: number) => (ms ? `${(ms / 1000).toFixed(1)}s` : '-'),
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).fromNow(),
    },
  ];
}
