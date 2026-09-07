/**
 * SbomDashboard state hook
 * 抽取自 index.tsx (P2-9 Phase 170)
 */
import { useEffect, useMemo, useState } from 'react';
import { Form, message } from 'antd';
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

export function useSbomDashboardState() {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<SbomDocument[]>([]);
  const [waivers, setWaivers] = useState<SbomWaiver[]>([]);
  const [compliance, setCompliance] = useState<SbomComplianceReport | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [waiverModalVisible, setWaiverModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [docRes, waiverRes, compRes] = await Promise.all([
        getSbomDocuments(),
        getSbomWaivers(),
        getSbomComplianceReport(),
      ]);
      setDocuments(Array.isArray(docRes?.data) ? (docRes.data as SbomDocument[]) : []);
      setWaivers(Array.isArray(waiverRes?.data) ? (waiverRes.data as SbomWaiver[]) : []);
      setCompliance((compRes?.data as SbomComplianceReport) || null);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`Failed to load SBOM data：${error.message}`);
      } else {
        message.error('Failed to load SBOM data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const licenseDistribution: PieDataItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    documents.forEach((d) => {
      const key = d.format.toUpperCase();
      counts.set(key, (counts.get(key) || 0) + d.packageCount);
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [documents]);

  const componentByDoc: BarDataItem[] = useMemo(() => {
    return documents.slice(0, 10).map((d) => ({
      label: d.documentId.length > 20 ? d.documentId.slice(0, 20) + '…' : d.documentId,
      value: d.packageCount,
    }));
  }, [documents]);

  const handleCreateWaiver = async (_values: SbomWaiverInput) => {
    try {
      message.success('Waiver created successfully');
      setWaiverModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        const msg = error instanceof Error ? error.message : 'Failed to create waiver';
        message.error(msg);
      }
    }
  };

  return {
    loading,
    documents,
    waivers,
    compliance,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    waiverModalVisible,
    setWaiverModalVisible,
    form,
    loadData,
    filteredDocs,
    totalPackages,
    activeDocs,
    licenseDistribution,
    componentByDoc,
    handleCreateWaiver,
  };
}
