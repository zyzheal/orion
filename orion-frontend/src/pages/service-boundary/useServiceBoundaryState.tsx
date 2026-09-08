import { useState } from 'react';
import { Button, Progress, Space, Tag, Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '@/api/client';
import { useQuery } from '@/providers/QueryProvider';
import { FALLBACK_MODULES } from './constants';
import type { ModuleRef } from './types';

const { Text } = Typography;

export function useServiceBoundaryState() {
  const [selected, setSelected] = useState<ModuleRef | null>(null);

  const { data: modules, isLoading: loading, refetch } = useQuery<ModuleRef[]>({
    queryKey: ['module-coupling'],
    queryFn: async () => {
      try {
        const resp = await api.get<ModuleRef[]>('/architecture/module-coupling');
        if (Array.isArray(resp.data)) return resp.data;
      } catch { /* fallback */ }
      return FALLBACK_MODULES;
    },
  });

  const load = () => refetch();

  const safeModules = modules ?? FALLBACK_MODULES;
  const highRiskCount = safeModules.filter((m) => m.risk === 'high').length;
  const noInterfaceCount = safeModules.filter((m) => !m.hasInterface).length;
  const avgRefs = safeModules.length > 0
    ? Math.round(safeModules.reduce((s, m) => s + m.references, 0) / safeModules.length)
    : 0;
  const interfaceRate = safeModules.length > 0
    ? Math.round((safeModules.filter((m) => m.hasInterface).length / safeModules.length) * 100)
    : 0;

  const moduleColumns: ColumnsType<ModuleRef> = [
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      render: (v: string) => <Text strong><CodeOutlined style={{ marginRight: 4 }} />{v}</Text>,
    },
    {
      title: '被引用次数',
      dataIndex: 'references',
      key: 'references',
      width: 110,
      sorter: (a: ModuleRef, b: ModuleRef) => a.references - b.references,
      render: (v: number) => (
        <Space>
          <Progress type="circle" size={28} percent={Math.min(v / 3, 100)} format={() => `${v}`} />
        </Space>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'risk',
      key: 'risk',
      width: 90,
      render: (v: string) => {
        const c = v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'green';
        const l = v === 'high' ? '高' : v === 'medium' ? '中' : '低';
        return <Tag color={c}>{l}</Tag>;
      },
    },
    { title: '子文件数', dataIndex: 'files', key: 'files', width: 90 },
    {
      title: '行数',
      dataIndex: 'lines',
      key: 'lines',
      width: 90,
      render: (v: number) => (v > 0 ? v.toLocaleString() : '—'),
    },
    {
      title: '接口层',
      key: 'interface',
      width: 80,
      render: (_: unknown, r: ModuleRef) => (
        r.hasInterface ? <Tag color="green">已定义</Tag> : <Tag color="red">缺失</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, r: ModuleRef) => (
        <Button size="small" onClick={() => setSelected(r)}>详情</Button>
      ),
    },
  ];

  return {
    loading, load, selected, setSelected, safeModules,
    highRiskCount, noInterfaceCount, avgRefs, interfaceRate,
    moduleColumns,
  };
}

export type ServiceBoundaryState = ReturnType<typeof useServiceBoundaryState>;
