/**
 * TestReport CasesTab
 * 抽取自 index.tsx (P2-9 Phase 191)
 */
import { Card, Col, Descriptions, Row, Select, Space, Statistic, Table, Typography } from 'antd';
import { spacing } from '@/tokens';
import type { TestReport, TestCase } from '@/api/testReports';
import { CASE_STATUS_OPTIONS } from '../constants';

const { Text, Search } = Typography;

interface CasesTabProps {
  selectedReport: TestReport | null;
  filteredCases: TestCase[];
  caseLoading: boolean;
  caseSearch: string;
  caseStatusFilter: string;
  columns: Parameters<typeof Table>[0]['columns'];
  onCaseSearchChange: (v: string) => void;
  onCaseStatusFilterChange: (v: string) => void;
}

export const CasesTab = ({
  selectedReport,
  filteredCases,
  caseLoading,
  caseSearch,
  caseStatusFilter,
  columns,
  onCaseSearchChange,
  onCaseStatusFilterChange,
}: CasesTabProps) => (
  <div>
    {selectedReport ? (
      <>
        <Descriptions
          size="small"
          column={3}
          style={{ marginBottom: spacing.md }}
          bordered
        >
          <Descriptions.Item label="报告">{selectedReport.suiteName}</Descriptions.Item>
          <Descriptions.Item label="格式">
            {selectedReport.format.toUpperCase()}
          </Descriptions.Item>
          <Descriptions.Item label="耗时">
            {(selectedReport.duration / 1000).toFixed(1)}s
          </Descriptions.Item>
        </Descriptions>

        {selectedReport.coverage && (
          <Card title="覆盖率" size="small" style={{ marginBottom: spacing.md }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="行覆盖率"
                  value={selectedReport.coverage.lines}
                  precision={1}
                  suffix="%"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="分支覆盖率"
                  value={selectedReport.coverage.branches}
                  precision={1}
                  suffix="%"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="函数覆盖率"
                  value={selectedReport.coverage.functions}
                  precision={1}
                  suffix="%"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="语句覆盖率"
                  value={selectedReport.coverage.statements}
                  precision={1}
                  suffix="%"
                />
              </Col>
            </Row>
          </Card>
        )}

        <Space style={{ marginBottom: spacing.md }}>
          <Search
            placeholder="搜索用例名称"
            value={caseSearch}
            onChange={(e) => onCaseSearchChange(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            value={caseStatusFilter}
            onChange={onCaseStatusFilterChange}
            style={{ width: 120 }}
            options={CASE_STATUS_OPTIONS}
          />
          <Text type="secondary">共 {filteredCases.length} 个用例</Text>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredCases}
          loading={caseLoading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 50 }}
        />
      </>
    ) : (
      <Text type="secondary">请先选择一个报告查看详情</Text>
    )}
  </div>
);
