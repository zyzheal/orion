/**
 * TestReport CasesTab (Tab 2)
 * 抽取自 index.tsx (P2-9 Phase 167)
 */
import {
  Card,
  Col,
  Descriptions,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd';
import { spacing } from '@/tokens';
import type { TestReport, TestCase } from '@/api/testReports';
import { caseStatusOptions } from '../constants';

const { Text: TText } = Typography;

interface CasesTabProps {
  selectedReport: TestReport | null;
  filteredCases: TestCase[];
  caseLoading: boolean;
  caseSearch: string;
  setCaseSearch: (v: string) => void;
  caseStatusFilter: string;
  setCaseStatusFilter: (v: string) => void;
  caseColumns: any[];
}

const { Search } = Input;

export const CasesTab = ({
  selectedReport,
  filteredCases,
  caseLoading,
  caseSearch,
  setCaseSearch,
  caseStatusFilter,
  setCaseStatusFilter,
  caseColumns,
}: CasesTabProps) => {
  if (!selectedReport) {
    return <TText type="secondary">请先选择一个报告查看详情</TText>;
  }
  return (
    <div>
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
          onChange={(e) => setCaseSearch(e.target.value)}
          style={{ width: 250 }}
        />
        <Select
          value={caseStatusFilter}
          onChange={setCaseStatusFilter}
          style={{ width: 120 }}
          options={caseStatusOptions}
        />
        <TText type="secondary">共 {filteredCases.length} 个用例</TText>
      </Space>

      <Table
        columns={caseColumns}
        dataSource={filteredCases}
        loading={caseLoading}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 50 }}
      />
    </div>
  );
};
