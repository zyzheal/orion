/**
 * Version Table - Artifact version list with filters, actions, and selection
 */
import React from 'react';
import { Tag, Space, Button, Tooltip, Typography, DatePicker, Select } from 'antd';
import {
  EyeOutlined,
  RocketOutlined,
  SwapOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import type { ArtifactVersion } from '@/api/artifactVersions';
import dayjs from 'dayjs';
import { spacing } from '@/tokens';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Stage color mapping for pipeline stages
const stageColorMap: Record<string, string> = {
  build: 'blue',
  test: 'green',
  package: 'purple',
  deploy: 'orange',
  release: 'gold',
};

interface VersionTableProps {
  dataSource: ArtifactVersion[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  onViewTraceability: (record: ArtifactVersion) => void;
  onDeploy: (record: ArtifactVersion) => void;
  onCompare: (versions: ArtifactVersion[]) => void;
  onFilter: (filters: VersionFilters) => void;
  onPaginationChange: (page: number, size: number) => void;
  pipelineOptions: Array<{ label: string; value: string }>;
}

export interface VersionFilters {
  pipelineId?: string;
  branch?: string;
  dateRange?: [string, string];
}

const VersionTable: React.FC<VersionTableProps> = ({
  dataSource,
  loading,
  currentPage,
  pageSize,
  total,
  onViewTraceability,
  onDeploy,
  onCompare,
  onFilter,
  onPaginationChange,
  pipelineOptions,
}) => {
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<ArtifactVersion[]>([]);
  const [pipelineFilter, setPipelineFilter] = React.useState<string | undefined>();
  const [branchFilter, setBranchFilter] = React.useState<string | undefined>();
  const [dateRange, setDateRange] = React.useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Handle filter changes
  const applyFilters = (updates: Partial<VersionFilters>) => {
    const newFilters: VersionFilters = {
      pipelineId: updates.pipelineId !== undefined ? updates.pipelineId : pipelineFilter,
      branch: updates.branch !== undefined ? updates.branch : branchFilter,
      dateRange: updates.dateRange !== undefined ? updates.dateRange : dateRange?.map(d => d.format('YYYY-MM-DD')) as [string, string] | undefined,
    };
    onFilter(newFilters);
  };

  const handlePipelineChange = (value: string | undefined) => {
    setPipelineFilter(value);
    applyFilters({ pipelineId: value });
  };

  const handleBranchChange = (value: string | undefined) => {
    setBranchFilter(value);
    applyFilters({ branch: value });
  };

  const handleDateRangeChange = (dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    setDateRange(dates);
    if (dates) {
      applyFilters({ dateRange: [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')] });
    } else {
      applyFilters({ dateRange: undefined });
    }
  };

  // Comparison button - enabled when exactly 2 versions selected
  const canCompare = selectedRowKeys.length === 2;

  const columns: TableColumn<ArtifactVersion>[] = [
    {
      key: 'version',
      title: '版本',
      dataIndex: 'version',
      width: 140,
      sortable: true,
      render: (v: unknown, record: ArtifactVersion) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => onViewTraceability(record)}>
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.artifactName}
          </Text>
        </Space>
      ),
    },
    {
      key: 'pipelineId',
      title: 'Pipeline',
      dataIndex: 'pipelineId',
      width: 160,
      ellipsis: true,
      render: (v: unknown) => (
        <Text code style={{ fontSize: 11 }}>
          {String(v)}
        </Text>
      ),
    },
    {
      key: 'stageName',
      title: '阶段',
      width: 90,
      render: (_: unknown, record: ArtifactVersion) => (
        <Tag color={stageColorMap[record.stageName] || 'default'}>
          {record.stageName}
        </Tag>
      ),
    },
    {
      key: 'commitSha',
      title: 'Commit SHA',
      dataIndex: 'commitSha',
      width: 140,
      render: (v: unknown) =>
        v ? (
          <Tooltip title="查看提交">
            <Text code style={{ fontSize: 11, cursor: 'pointer' }}>
              <GithubOutlined /> {String(v).slice(0, 7)}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'branch',
      title: '分支',
      dataIndex: 'branch',
      width: 120,
      render: (v: unknown) =>
        v ? (
          <Tag color="geekblue">{String(v)}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 150,
      sortable: true,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(v)).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: ArtifactVersion) => (
        <Space size="small" wrap>
          <Tooltip title="查看追溯链">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onViewTraceability(record)}
            >
              追溯
            </Button>
          </Tooltip>
          <Tooltip title="部署该版本">
            <Button
              type="link"
              size="small"
              icon={<RocketOutlined />}
              onClick={() => onDeploy(record)}
            >
              部署
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[], rows: ArtifactVersion[]) => {
      setSelectedRowKeys(keys);
      setSelectedRows(rows);
    },
    getCheckboxProps: (record: ArtifactVersion) => ({
      disabled: record.stageName !== 'build', // Only allow selecting build versions for comparison
    }),
  };

  // Extract unique branches from current data for filter dropdown
  const branchOptions = React.useMemo(() => {
    const branches = new Set<string>();
    dataSource.forEach((v) => {
      if (v.branch) branches.add(v.branch);
    });
    return Array.from(branches).map((b) => ({ label: b, value: b }));
  }, [dataSource]);

  return (
    <div>
      {/* Filter Bar */}
      <Space wrap style={{ marginBottom: spacing.md }}>
        <Select
          allowClear
          placeholder="按 Pipeline 筛选"
          style={{ width: 200 }}
          value={pipelineFilter}
          onChange={handlePipelineChange}
          options={pipelineOptions}
        />
        <Select
          allowClear
          placeholder="按分支筛选"
          style={{ width: 150 }}
          value={branchFilter}
          onChange={handleBranchChange}
          options={branchOptions}
        />
        <RangePicker
          placeholder={['开始日期', '结束日期']}
          value={dateRange}
          onChange={handleDateRangeChange as any}
          style={{ width: 260 }}
        />
        {canCompare && (
          <Button
            type="primary"
            icon={<SwapOutlined />}
            onClick={() => onCompare(selectedRows)}
          >
            对比选中版本
          </Button>
        )}
        {selectedRowKeys.length > 0 && (
          <Text type="secondary">
            已选择 {selectedRowKeys.length} 个版本
          </Text>
        )}
      </Space>

      {/* Version Table */}
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
        rowSelection={rowSelection}
      />
    </div>
  );
};

export default VersionTable;
