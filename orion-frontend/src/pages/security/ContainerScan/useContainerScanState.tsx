/**
 * ContainerScan state hook
 * 抽取自 index.tsx (P2-9 Phase 133)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Form, message } from 'antd';
import { listContainerScans, runContainerScan } from '@/api/containerScan';
import type { ImageScanRecord, ScanPolicy, ScanStatus, VulnDistribution } from './types';
import { calcVulnDistribution } from './helpers';

export const useContainerScanState = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScanStatus | 'all'>('all');
  const [scanningKey, setScanningKey] = useState<string | null>(null);
  const [policyForm] = Form.useForm();
  const [policy, setPolicy] = useState<ScanPolicy>({
    engine: 'Trivy',
    frequency: '每次推送',
    threshold: 'Critical+High',
    autoBlock: true,
  });
  const [scanData, setScanData] = useState<ImageScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listContainerScans({ page: 1, page_size: 100 });
      const raw = res.data as { data?: ImageScanRecord[] } | ImageScanRecord[];
      setScanData(Array.isArray(raw) ? raw : raw.data || []);
    } catch (err: unknown) {
      message.error(`加载扫描数据失败: ${(err as Error).message}`);
      setScanData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  const handleScan = useCallback(
    async (record: ImageScanRecord) => {
      setScanningKey(record.key);
      try {
        await runContainerScan({ image: record.image, tag: record.tag, engine: policy.engine });
        message.success('扫描已发起');
        loadScans();
      } catch (err: unknown) {
        message.error(`发起扫描失败: ${(err as Error).message}`);
      } finally {
        setScanningKey(null);
      }
    },
    [policy.engine, loadScans]
  );

  const filteredData = useMemo(() => {
    let data = scanData;
    if (searchText) {
      const keyword = searchText.toLowerCase();
      data = data.filter(
        (r) => r.image.toLowerCase().includes(keyword) || r.tag.toLowerCase().includes(keyword)
      );
    }
    if (statusFilter !== 'all') {
      data = data.filter((r) => r.status === statusFilter);
    }
    return data;
  }, [searchText, statusFilter, scanData]);

  const vulnDist: VulnDistribution[] = useMemo(() => calcVulnDistribution(scanData), [scanData]);

  const totalImages = scanData.length;
  const highVulns = scanData.reduce((s, r) => s + r.critical + r.high, 0);
  const passedCount = scanData.filter((r) => r.status === 'passed').length;
  const fixRate = totalImages > 0 ? Math.round((passedCount / totalImages) * 100) : 0;
  const pendingScan = scanData.filter((r) => r.status === 'failed').length;

  return {
    searchText,
    setSearchText,
    statusFilter,
    setStatusFilter,
    scanningKey,
    policyForm,
    policy,
    setPolicy,
    scanData,
    loading,
    loadScans,
    handleScan,
    filteredData,
    vulnDist,
    totalImages,
    highVulns,
    fixRate,
    pendingScan,
  };
};

export type ContainerScanState = ReturnType<typeof useContainerScanState>;
