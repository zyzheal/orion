/**
 * TestReport state hook
 * 抽取自 index.tsx (P2-9 Phase 167)
 */
import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { useParams } from 'react-router-dom';
import {
  getTestReports,
  getTestCases,
  getRunSummary,
  type TestReport,
  type TestCase,
  type TestReportSummary,
} from '@/api/testReports';

export function useTestReportState() {
  const { runId } = useParams<{ runId: string }>();

  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<TestReport[]>([]);
  const [summary, setSummary] = useState<TestReportSummary | null>(null);
  const [selectedReport, setSelectedReport] = useState<TestReport | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('list');

  const loadReports = async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const [reportsRes, summaryRes] = await Promise.all([
        getTestReports({ runId, page: 1, pageSize: 100 }),
        getRunSummary(runId),
      ]);
      if (reportsRes.data) {
        setReports(reportsRes.data.items || []);
      }
      if (summaryRes.data) {
        setSummary(summaryRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载测试报告失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const loadCases = async (reportId: string) => {
    setCaseLoading(true);
    try {
      const res = await getTestCases(reportId, { page: 1, pageSize: 200 });
      if (res.data) {
        setCases(res.data.items || []);
      }
    } catch {
      message.error('加载测试用例失败');
    } finally {
      setCaseLoading(false);
    }
  };

  const handleSelectReport = async (report: TestReport) => {
    setSelectedReport(report);
    setActiveTab('cases');
    await loadCases(report.id);
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (caseStatusFilter !== 'all' && c.status !== caseStatusFilter) return false;
      if (caseSearch) {
        const q = caseSearch.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.fullName?.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [cases, caseSearch, caseStatusFilter]);

  return {
    runId,
    loading,
    reports,
    summary,
    selectedReport,
    setSelectedReport,
    cases,
    caseLoading,
    caseSearch,
    setCaseSearch,
    caseStatusFilter,
    setCaseStatusFilter,
    activeTab,
    setActiveTab,
    filteredCases,
    loadReports,
    loadCases,
    handleSelectReport,
  };
}
