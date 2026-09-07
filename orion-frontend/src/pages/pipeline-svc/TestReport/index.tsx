/**
 * Test Report Viewer Page
 * View test reports from pipeline runs with case-level details
 *
 * 拆分自 index.tsx (P2-9 Phase 191)
 */
import { useMemo } from 'react';
import { Table, Tabs } from 'antd';
import { useTestReportState } from './useTestReportState';
import { buildCaseColumns, buildReportColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { SummaryRow } from './Components/SummaryRow';
import { CasesTab } from './Components/CasesTab';

const TestReportPage = () => {
  const {
    runId,
    loading,
    reports,
    summary,
    selectedReport,
    caseLoading,
    caseSearch,
    caseStatusFilter,
    activeTab,
    filteredCases,
    loadReports,
    setCaseSearch,
    setCaseStatusFilter,
    setActiveTab,
    handleSelectReport,
  } = useTestReportState();

  const reportColumns = useMemo(
    () => buildReportColumns({ onSelectReport: handleSelectReport }),
    [handleSelectReport]
  );
  const caseColumns = useMemo(() => buildCaseColumns({}), []);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader runId={runId} loading={loading} onRefresh={loadReports} />

      {summary && <SummaryRow summary={summary} />}

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
                caseStatusFilter={caseStatusFilter}
                columns={caseColumns}
                onCaseSearchChange={setCaseSearch}
                onCaseStatusFilterChange={setCaseStatusFilter}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default TestReportPage;
