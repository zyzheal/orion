/**
 * ContainerScan table columns
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import { Typography, Tag, Space, Button, Tooltip } from 'antd';
import { EyeOutlined, ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ImageScanRecord } from './types';
import { commonStyle } from './constants';
import { renderStatus, renderVulnTotal } from './helpers';

const { Text } = Typography;

interface ScanColumnsDeps {
  scanningKey: string | null;
  handleScan: (record: ImageScanRecord) => void;
}

export const buildScanColumns = ({
  scanningKey,
  handleScan,
}: ScanColumnsDeps): ColumnsType<ImageScanRecord> => [
  {
    title: '镜像名称',
    dataIndex: 'image',
    key: 'image',
    render: (text: string) => (
      <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
        {text}
      </Text>
    ),
  },
  {
    title: '标签',
    dataIndex: 'tag',
    key: 'tag',
    render: (text: string) => <Tag style={{ borderRadius: 6 }}>{text}</Tag>,
  },
  {
    title: '扫描时间',
    dataIndex: 'scanTime',
    key: 'scanTime',
    render: (text: string) => <Text type="secondary">{text}</Text>,
  },
  {
    title: '漏洞总数',
    key: 'total',
    render: (_: unknown, record?: ImageScanRecord) => (record ? renderVulnTotal(record) : null),
  },
  {
    title: '高危',
    dataIndex: 'critical',
    key: 'critical',
    render: (val: number) =>
      val > 0 ? <Tag color={commonStyle.error}>{val}</Tag> : <Text>-</Text>,
  },
  {
    title: '中危',
    dataIndex: 'medium',
    key: 'medium',
    render: (val: number) =>
      val > 0 ? <Tag color={commonStyle.warning}>{val}</Tag> : <Text>-</Text>,
  },
  {
    title: '低危',
    dataIndex: 'low',
    key: 'low',
    render: (val: number) =>
      val > 0 ? <Tag color={commonStyle.info}>{val}</Tag> : <Text>-</Text>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (val: ImageScanRecord['status']) => renderStatus(val),
  },
  {
    title: '操作',
    key: 'action',
    render: (_: unknown, record?: ImageScanRecord) =>
      record ? (
        <Space size={8}>
          <Tooltip title="扫描详情 API 开发中">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: commonStyle.primary }}
              disabled
            />
          </Tooltip>
          <Tooltip title="重新扫描">
            <Button
              type="text"
              size="small"
              icon={scanningKey === record.key ? <ReloadOutlined spin /> : <PlayCircleOutlined />}
              loading={scanningKey === record.key}
              style={{ color: commonStyle.info }}
              disabled={scanningKey === record.key}
              onClick={() => handleScan(record)}
            />
          </Tooltip>
        </Space>
      ) : null,
  },
];
