/**
 * Test Report Viewer Page
 * View test reports from pipeline runs with case-level details
 * 组件化重构 (P2-9 Phase 167): 413→68 行
 */
import React from 'react';
import { Table, Tabs } from 'antd';
import { useTestReportState } from './useTestReportState';
import { buildCaseColumns, buildReportColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { SummaryCard } from './Components/SummaryCard';
import { CasesTab } from './Components/CasesTab';

const TestReportPage: React.FC = () => {
  const {
    runId,
    loading,
    reports,
    summary,
    selectedReport,
    caseLoading,
    caseSearch,
    setCaseSearch,
    caseStatusFilter,
    setCaseStatusFilter,
    activeTab,
    setActiveTab,
    filteredCases,
    loadReports,
    handleSelectReport,
  } = useTestReportState();

  const caseColumns = buildCaseColumns();
  const reportColumns = buildReportColumns({ handleSelectReport });

  return (
    <div style={{ padding: 0 }}>
      <PageHeader runId={runId} loading={loading} onRefresh={loadReports} />

      {summary && <SummaryCard summary={summary} />}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: '报告列表',
            children: (
              <Table
                columns={reportColumns}
                dataSource={reports}
                loading={loading}
                rowKey="id"
                size="middle"
              />
            ),
          },
          {
            key: 'cases',
            label: '测试用例',
            children: (
              <CasesTab
                selectedReport={selectedReport}
                filteredCases={filteredCases}
                caseLoading={caseLoading}
                caseSearch={caseSearch}
                setCaseSearch={setCaseSearch}
                caseStatusFilter={caseStatusFilter}
                setCaseStatusFilter={setCaseStatusFilter}
                caseColumns={caseColumns}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default TestReportPage;
