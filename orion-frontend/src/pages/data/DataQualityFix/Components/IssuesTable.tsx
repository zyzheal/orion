/**
 * DataQualityFix issues table with filters
 * 抽取自 index.tsx (P2-9 Phase 146)
 */
import React, { useMemo } from 'react';
import { Card, Empty, Select, Space, Table } from 'antd';
import { spacing } from '@/tokens';
import { PROBLEM_TYPE_CONFIG, SEVERITY_CONFIG, STATUS_CONFIG } from '../constants';
import { buildIssueColumns } from '../issueColumns';
import type { ProblemType, Severity, Status, QualityIssue } from '../types';

const { Option } = Select;

export interface IssuesTableProps {
  issues: QualityIssue[];
  filterType: ProblemType | undefined;
  onFilterTypeChange: (v: ProblemType | undefined) => void;
  filterSeverity: Severity | undefined;
  onFilterSeverityChange: (v: Severity | undefined) => void;
  filterStatus: Status | undefined;
  onFilterStatusChange: (v: Status | undefined) => void;
}

export const IssuesTable: React.FC<IssuesTableProps> = ({
  issues,
  filterType,
  onFilterTypeChange,
  filterSeverity,
  onFilterSeverityChange,
  filterStatus,
  onFilterStatusChange,
}) => {
  const columns = useMemo(() => buildIssueColumns(), []);

  return (
    <Card title="质量问题列表" style={{ marginTop: spacing.md }}>
      <Space style={{ marginBottom: spacing.md }} size="middle">
        <Select
          placeholder="问题类型"
          style={{ width: 130 }}
          allowClear
          value={filterType}
          onChange={(v) => onFilterTypeChange(v)}
        >
          {Object.entries(PROBLEM_TYPE_CONFIG).map(([key, cfg]) => (
            <Option key={key} value={key}>
              {cfg.label}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="严重程度"
          style={{ width: 130 }}
          allowClear
          value={filterSeverity}
          onChange={(v) => onFilterSeverityChange(v)}
        >
          {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
            <Option key={key} value={key}>
              {cfg.label}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="状态"
          style={{ width: 130 }}
          allowClear
          value={filterStatus}
          onChange={(v) => onFilterStatusChange(v)}
        >
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <Option key={key} value={key}>
              {cfg.label}
            </Option>
          ))}
        </Select>
      </Space>
      <Table
        columns={columns}
        dataSource={issues}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        locale={{ emptyText: <Empty description="暂无数据质量问题" /> }}
      />
    </Card>
  );
};
