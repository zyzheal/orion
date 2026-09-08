/**
 * useDevPortalState.ts - Developer Portal 状态 Hook
 * 抽取自 index.tsx (P2-9 Phase 241)
 */
import { useState, useMemo } from 'react';
import { message } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { api } from '@/api/client';

export interface ServiceComponent {
  id: string;
  name: string;
  type: 'service' | 'library' | 'site' | 'tool';
  owner: string;
  lifecycle: 'production' | 'experimental' | 'deprecated';
  health: number;
  techDocs: boolean;
  lastDeployed: string;
  language: string;
  repo: string;
}

export const FALLBACK_COMPONENTS: ServiceComponent[] = [
  { id: '1', name: 'orion-platform-svc-go', type: 'service', owner: 'platform-team', lifecycle: 'production', health: 98, techDocs: true, lastDeployed: '2026-08-25', language: 'Go', repo: 'github.com/orion/platform-svc' },
  { id: '2', name: 'orion-frontend', type: 'service', owner: 'platform-team', lifecycle: 'production', health: 95, techDocs: true, lastDeployed: '2026-08-26', language: 'TypeScript', repo: 'github.com/orion/frontend' },
  { id: '3', name: 'orion-agent-runtime', type: 'service', owner: 'ai-team', lifecycle: 'production', health: 92, techDocs: true, lastDeployed: '2026-08-20', language: 'Go', repo: 'github.com/orion/agent-runtime' },
  { id: '4', name: 'orion-shared-lib', type: 'library', owner: 'platform-team', lifecycle: 'production', health: 100, techDocs: false, lastDeployed: '2026-08-15', language: 'TypeScript', repo: 'github.com/orion/shared-lib' },
  { id: '5', name: 'orion-doc-site', type: 'site', owner: 'docs-team', lifecycle: 'production', health: 88, techDocs: true, lastDeployed: '2026-08-18', language: 'Markdown', repo: 'github.com/orion/docs' },
  { id: '6', name: 'orion-ml-sdk', type: 'library', owner: 'ai-team', lifecycle: 'experimental', health: 76, techDocs: false, lastDeployed: '2026-08-22', language: 'Python', repo: 'github.com/orion/ml-sdk' },
];

async function fetchComponents(): Promise<ServiceComponent[]> {
  try {
    const resp = await api.get<ServiceComponent[]>('/developer-portal/components');
    if (Array.isArray(resp.data)) return resp.data;
  } catch {
    return FALLBACK_COMPONENTS;
  }
  return FALLBACK_COMPONENTS;
}

export function useDevPortalState() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ServiceComponent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: components, isLoading: loading } = useQuery<ServiceComponent[]>({
    queryKey: ['developer-portal/components'],
    queryFn: fetchComponents,
    staleTime: 30_000,
  });

  const safeComponents = components ?? FALLBACK_COMPONENTS;

  const filtered = useMemo(
    () =>
      search
        ? safeComponents.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.owner.includes(search.toLowerCase()))
        : safeComponents,
    [safeComponents, search]
  );

  const stats = useMemo(
    () => ({
      total: safeComponents.length,
      services: safeComponents.filter((c) => c.type === 'service').length,
      libraries: safeComponents.filter((c) => c.type === 'library').length,
      healthy: safeComponents.filter((c) => c.health >= 90).length,
    }),
    [safeComponents]
  );

  const avgHealth = safeComponents.length > 0
    ? Math.round(safeComponents.reduce((s, c) => s + c.health, 0) / safeComponents.length)
    : 0;

  const handleView = (c: ServiceComponent) => {
    setSelected(c);
    setDetailOpen(true);
  };

  const handleOpenRepo = (c: ServiceComponent) => {
    window.open(`https://${c.repo}`, '_blank');
    message.success(`已打开 ${c.name} 仓库`);
  };

  return {
    search, setSearch,
    selected, setSelected,
    detailOpen, setDetailOpen,
    loading,
    safeComponents,
    filtered,
    stats,
    avgHealth,
    handleView,
    handleOpenRepo,
  };
}
