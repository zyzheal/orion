import { useState } from 'react';
import { Button, Space, Tag, Typography } from 'antd';
const { Text } = Typography;
import { PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import { useQuery } from '@/providers/QueryProvider';
import type { Contract } from './types';
import { FALLBACK_CONTRACTS, STATUS_MAP, METHOD_COLOR } from './constants';

export function useContractTestState() {
  const [selected, setSelected] = useState<Contract | null>(null);
  const [verifying, setVerifying] = useState(false);

  const { data: contracts, isLoading: loading, refetch } = useQuery<Contract[]>({
    queryKey: ['contract-test/contracts'],
    queryFn: async () => {
      try {
        const resp = await api.get<Contract[]>('/contract-test/contracts');
        if (Array.isArray(resp.data)) return resp.data;
      } catch { /* fallback */ }
      return FALLBACK_CONTRACTS;
    },
  });

  const load = () => refetch();
  const safeContracts = contracts ?? FALLBACK_CONTRACTS;

  const stats = {
    total: safeContracts.length,
    verified: safeContracts.filter((c) => c.status === 'verified').length,
    drift: safeContracts.filter((c) => c.status === 'drift').length,
    missing: safeContracts.filter((c) => c.status === 'missing').length,
    rate: safeContracts.length > 0 ? Math.round((safeContracts.filter((c) => c.status === 'verified').length / safeContracts.length) * 100) : 0,
  };

  const handleVerify = async (c: Contract) => {
    setVerifying(true);
    try {
      await api.post('/contract-test/verify', undefined, {
        params: { consumer: c.consumer, provider: c.provider, endpoint: c.endpoint },
      });
      load();
    } catch { /* fallback */ }
    finally { setVerifying(false); }
  };

  const columns: ColumnsType<Contract> = [
    { title: 'Consumer', dataIndex: 'consumer', key: 'consumer', width: 130 },
    { title: 'Provider', dataIndex: 'provider', key: 'provider', width: 160 },
    { title: 'Method', dataIndex: 'method', key: 'method', width: 70,
      render: (v: string) => <Tag color={METHOD_COLOR[v] || 'default'}>{v}</Tag> },
    { title: 'Endpoint', dataIndex: 'endpoint', key: 'endpoint', render: (v: string) => <Text code>{v}</Text> },
    { title: '版本', dataIndex: 'version', key: 'version', width: 70 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const m = STATUS_MAP[v] || { color: 'default', label: v };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    { title: '最后验证', dataIndex: 'lastVerified', key: 'lastVerified', width: 100,
      render: (v: string) => (v ? v.slice(0, 10) : '—') },
    { title: '操作', key: 'action', width: 100,
      render: (_: unknown, r: Contract) => (
        <Space size="small">
          <Button size="small" icon={<PlayCircleOutlined />} loading={verifying} onClick={() => handleVerify(r)}>验证</Button>
          <Button size="small" onClick={() => setSelected(r)}>详情</Button>
        </Space>
      ),
    },
  ];

  return {
    selected, setSelected, verifying, loading, refetch,
    safeContracts, stats, load, handleVerify, columns,
  };
}
