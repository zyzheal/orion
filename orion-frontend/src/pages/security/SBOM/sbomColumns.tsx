/**
 * SBOM table columns
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import { Typography, Tag, Space, Button, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { SBOMComponent } from './types';
import {
  typeTagColor,
  typeTagIcon,
  statusTagProps,
  severityColor,

  cPrimary,
  cWarning,
  cNeutral,
  LICENSE_VIOLATIONS,
} from './constants';
import { vulnTagColor } from './helpers';

const { Text } = Typography;
const sMd = spacing.md;

export interface SbomColumnsDeps {
  handleViewSBOM: (record: SBOMComponent) => void;
  handleViewVulnDetails: (record: SBOMComponent) => void;
}

export const buildSbomColumns = ({
  handleViewSBOM,
  handleViewVulnDetails,
}: SbomColumnsDeps): ColumnsType<SBOMComponent> => [
  {
    title: '组件名称',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => (
      <Text style={{ fontWeight: 600, color: colors.neutral[900] }}>{name}</Text>
    ),
  },
  {
    title: '版本',
    dataIndex: 'version',
    key: 'version',
    render: (v: string) => <Text code>{v}</Text>,
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    render: (type: SBOMComponent['type']) => (
      <Tag color={typeTagColor[type] || cNeutral}>{typeTagIcon[type]} {type}</Tag>
    ),
  },
  {
    title: '漏洞数',
    dataIndex: 'vulnCount',
    key: 'vulnCount',
    render: (count: number) => (
      <Tag color={vulnTagColor(count)} style={{ fontWeight: 600 }}>
        {count} 个
      </Tag>
    ),
  },
  {
    title: '许可证',
    dataIndex: 'license',
    key: 'license',
    render: (license: string) => {
      const isViolated = LICENSE_VIOLATIONS.includes(license);
      return (
        <Tag color={isViolated ? severityColor.Critical : cNeutral}>
          {isViolated ? <WarningOutlined style={{ marginRight: 4 }} /> : null}
          {license}
        </Tag>
      );
    },
  },
  {
    title: '最后扫描时间',
    dataIndex: 'lastScan',
    key: 'lastScan',
    render: (scan: string) => <Text type="secondary">{scan}</Text>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: SBOMComponent['status']) => {
      const props = statusTagProps[status];
      return (
        <Tag color={props.color}>
          <Space size={4}>
            {props.icon}
            <span>{props.text}</span>
          </Space>
        </Tag>
      );
    },
  },
  {
    title: '操作',
    key: 'action',
    render: (_: unknown, record?: SBOMComponent) =>
      record ? (
        <Space size={sMd}>
          <Tooltip title="查看 SBOM 报告">
            <Button
              size="small"
              type="primary"
              style={{ borderColor: cPrimary }}
              onClick={() => handleViewSBOM(record)}
            >
              <EyeOutlined style={{ marginRight: 4 }} /> SBOM
            </Button>
          </Tooltip>
          <Tooltip title="组件版本更新功能开发中">
            <Button size="small" disabled style={{ borderColor: cNeutral }}>
              <CloudUploadOutlined style={{ marginRight: 4 }} /> 更新
            </Button>
          </Tooltip>
          <Tooltip title="漏洞详情">
            <Button
              size="small"
              style={{ borderColor: cWarning }}
              onClick={() => handleViewVulnDetails(record)}
              disabled={record.vulnCount === 0}
            >
              <ExclamationCircleOutlined style={{ marginRight: 4 }} /> 漏洞
            </Button>
          </Tooltip>
        </Space>
      ) : null,
  },
];
