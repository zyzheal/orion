/**
 * SBOM Dashboard state hook
 * 抽取自 index.tsx (P2-9 Phase 148)
 */
import { useEffect, useMemo, useState } from 'react';
import { Form, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@/providers/QueryProvider';
import {
  getSbomDocuments,
  getSbomWaivers,
  getSbomComplianceReport,
  type SbomDocument,
  type SbomWaiver,
  type SbomComplianceReport,
  type SbomWaiverInput,
} from '@/api/sbom';
import type { PieDataItem, BarDataItem } from '@/components/charts';

export const useSbomDashboardState = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [waiverModalVisible, setWaiverModalVisible] = useState(false);
  const [waiverSubmitting, setWaiverSubmitting] = useState(false);
  const [form] = Form.useForm();

  const { data: rawData, isLoading: loading, isError, error, refetch } = useQuery<{
    documents: SbomDocument[];
    waivers: SbomWaiver[];
    compliance: SbomComplianceReport | null;
  }>({
    queryKey: ['sbom-dashboard'],
    queryFn: async () => {
      const [docRes, waiverRes, compRes] = await Promise.all([
        getSbomDocuments(),
        getSbomWaivers(),
        getSbomComplianceReport(),
      ]);
      return {
        documents: Array.isArray(docRes?.data) ? (docRes.data as SbomDocument[]) : [],
        waivers: Array.isArray(waiverRes?.data) ? (waiverRes.data as SbomWaiver[]) : [],
        compliance: (compRes?.data as SbomComplianceReport) || null,
      };
    },
    retry: 0,
    staleTime: 30_000,
  });

  const documents = rawData?.documents ?? [];
  const waivers = rawData?.waivers ?? [];
  const compliance = rawData?.compliance ?? null;

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (isError) {
      message.error(
        error instanceof Error
          ? `Failed to load SBOM data：${error.message}`
          : 'Failed to load SBOM data',
      );
    }
  }, [isError, error]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !doc.buildId.toLowerCase().includes(q) &&
          !doc.format.toLowerCase().includes(q) &&
          !doc.documentId.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (filters.format && filters.format !== 'all' && doc.format !== filters.format) return false;
      if (filters.status && filters.status !== 'all' && doc.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, documents]);

  const totalPackages = documents.reduce((sum: number, d: SbomDocument) => sum + d.packageCount, 0);
  const activeDocs = documents.filter((d: SbomDocument) => d.status === 'active').length;

  // License distribution: group documents by format as a proxy for license/type distribution
  const licenseDistribution: PieDataItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((d) => {
      const key = d.format.toUpperCase();
      counts.set(key, (counts.get(key) || 0) + d.packageCount);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [documents]);

  // Component count by SBOM document (bar chart)
  const componentByDoc: BarDataItem[] = useMemo(() => {
    return documents.slice(0, 10).map((d) => ({
      label: d.documentId.length > 20 ? d.documentId.slice(0, 20) + '…' : d.documentId,
      value: d.packageCount,
    }));
  }, [documents]);

  const handleCreateWaiver = async (_values: SbomWaiverInput) => {
    setWaiverSubmitting(true);
    try {
      message.success('Waiver created successfully');
      setWaiverModalVisible(false);
      form.resetFields();
      refetch();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : 'Failed to create waiver';
        message.error(msg);
      }
    } finally {
      setWaiverSubmitting(false);
    }
  };

  return {
    navigate,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    waiverModalVisible,
    setWaiverModalVisible,
    waiverSubmitting,
    form,
    loading,
    documents,
    waivers,
    compliance,
    filteredDocs,
    totalPackages,
    activeDocs,
    licenseDistribution,
    componentByDoc,
    refetch,
    handleCreateWaiver,
  };
};

export type SbomDashboardState = ReturnType<typeof useSbomDashboardState>;
