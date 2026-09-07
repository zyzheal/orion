/**
 * SBOM state hook
 * 抽取自 index.tsx (P2-9 Phase 134)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { getSbomDocuments } from '@/api/sbom';
import type { SBOMComponent, CVEVuln, LicenseItem, SbomStats } from './types';

export const useSbomState = () => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<SBOMComponent | null>(null);
  const [components, setComponents] = useState<SBOMComponent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSBOM = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSbomDocuments();
      const raw = res.data as unknown as SBOMComponent[] | { data?: SBOMComponent[] };
      setComponents(Array.isArray(raw) ? raw : raw.data || []);
    } catch (err: any) {
      message.error(`加载 SBOM 数据失败: ${err.message}`);
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSBOM();
  }, [loadSBOM]);

  const filteredComponents = useMemo(() => {
    return components.filter((comp) => {
      const matchType = filterType === 'all' || comp.type === filterType;
      const matchStatus = filterStatus === 'all' || comp.status === filterStatus;
      return matchType && matchStatus;
    });
  }, [filterType, filterStatus, components]);

  const stats: SbomStats = useMemo(() => {
    const totalVulns = components.reduce((sum, c) => sum + c.vulnCount, 0);
    const safeCount = components.filter((c) => c.status === 'safe').length;
    const complianceRate =
      components.length > 0 ? Math.round((safeCount / components.length) * 100) : 0;
    return {
      totalComponents: components.length,
      totalVulns,
      licenseViolations: 0,
      complianceRate,
    };
  }, [components]);

  const selectedVulns: CVEVuln[] = useMemo(
    () =>
      selectedComponent
        ? selectedComponent.vulnCount > 0
          ? [
              { cveId: 'CVE-2024-0001', severity: 'High', cvss: 7.5, fixedIn: '', description: '' },
            ]
          : []
        : [],
    [selectedComponent]
  );

  const licenseData: LicenseItem[] = [];

  const handleSelectComponent = useCallback((record: SBOMComponent) => {
    setSelectedComponent(record);
  }, []);

  const handleViewSBOM = useCallback((record: SBOMComponent) => {
    setSelectedComponent(record);
  }, []);

  const handleViewVulnDetails = useCallback(
    (record: SBOMComponent) => {
      setSelectedComponent(record);
    },
    []
  );

  return {
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    selectedComponent,
    components,
    loading,
    filteredComponents,
    stats,
    selectedVulns,
    licenseData,
    loadSBOM,
    handleSelectComponent,
    handleViewSBOM,
    handleViewVulnDetails,
  };
};

export type SbomState = ReturnType<typeof useSbomState>;
