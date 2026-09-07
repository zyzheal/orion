/**
 * useChangeIntelligenceState - ChangeIntelligence 状态 hook
 * 抽取自 index.tsx (P2-9 Phase 119)
 */
import { useState, useMemo, useEffect } from 'react';
import { Form, message } from 'antd';
import {
  getChangeReports,
  getChangeReportDetail,
  getBlastRadius,
  analyzeChange,
  getChangeTrends,
  type ChangeIntelligenceReport,
  type AffectedService,
  type BlastRadiusData,
  type ChangeAnalyzeInput,
} from '@/api/change-intelligence';

export const useChangeIntelligenceState = () => {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ChangeIntelligenceReport[]>([]);
  const [trends, setTrends] = useState<Array<Record<string, unknown>>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [analyzeModalVisible, setAnalyzeModalVisible] = useState(false);
  const [reportDetailVisible, setReportDetailVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ChangeIntelligenceReport | null>(null);
  const [blastRadius, setBlastRadius] = useState<BlastRadiusData | null>(null);
  const [affectedServices, setAffectedServices] = useState<AffectedService[]>([]);
  const [analyzeForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportRes, trendRes] = await Promise.all([
        getChangeReports(),
        getChangeTrends({ days: 30 }),
      ]);
      setReports(Array.isArray(reportRes.data) ? reportRes.data : []);
      setTrends(Array.isArray(trendRes.data) ? trendRes.data : []);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Failed to load change intelligence data';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !r.prId.toLowerCase().includes(q) &&
          !r.repoId.toLowerCase().includes(q) &&
          !r.commitSha.toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.riskLevel && filters.riskLevel !== 'all' && r.riskLevel !== filters.riskLevel)
        return false;
      return true;
    });
  }, [searchQuery, filters, reports]);

  const highRiskCount = reports.filter(
    (r) => r.riskLevel === 'high' || r.riskLevel === 'critical'
  ).length;
  const avgRiskScore =
    reports.length > 0 ? reports.reduce((sum, r) => sum + r.riskScore, 0) / reports.length : 0;

  const handleAnalyze = async (values: ChangeAnalyzeInput) => {
    try {
      await analyzeChange(values);
      message.success('Analysis triggered');
      setAnalyzeModalVisible(false);
      analyzeForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to trigger analysis';
      message.error(msg);
    }
  };

  const handleViewDetail = async (report: ChangeIntelligenceReport) => {
    setSelectedReport(report);
    try {
      const [detailRes, blastRes] = await Promise.all([
        getChangeReportDetail(report.id),
        getBlastRadius(report.id),
      ]);
      const detailData = detailRes.data as { affectedServices?: AffectedService[] } | undefined;
      const svcList = detailData?.affectedServices;
      setAffectedServices(Array.isArray(svcList) ? svcList : []);
      setBlastRadius((blastRes.data as BlastRadiusData) || null);
      setReportDetailVisible(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load report detail';
      message.error(msg);
    }
  };

  return {
    loading,
    reports,
    trends,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    analyzeModalVisible,
    setAnalyzeModalVisible,
    reportDetailVisible,
    setReportDetailVisible,
    selectedReport,
    setSelectedReport,
    blastRadius,
    affectedServices,
    analyzeForm,
    loadData,
    filteredReports,
    highRiskCount,
    avgRiskScore,
    handleAnalyze,
    handleViewDetail,
  };
};

export type ChangeIntelligenceState = ReturnType<typeof useChangeIntelligenceState>;
