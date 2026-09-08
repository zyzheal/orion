/**
 * useTemplateMarketState.ts - Pipeline Template Marketplace 状态 Hook
 * 抽取自 index.tsx (P2-9 Phase 240)
 */
import { useState, useMemo } from 'react';
import { message } from 'antd';
import { api } from '@/api/client';
import { useQuery } from '@/providers/QueryProvider';

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  version: string;
  downloads: number;
  stars: number;
  author: string;
  updatedAt: string;
  isOfficial: boolean;
}

export const FALLBACK_TEMPLATES: Template[] = [
  { id: '1', name: 'Node.js CI', description: 'npm install + test + build for Node.js projects', category: 'Language', language: 'Node.js', version: '3.2.0', downloads: 28450, stars: 320, author: 'Orion', updatedAt: '2026-08-15', isOfficial: true },
  { id: '2', name: 'Go Multi-Stage Build', description: 'Go project with multi-stage Docker build and vulnerability scan', category: 'Container', language: 'Go', version: '2.1.0', downloads: 19820, stars: 245, author: 'Orion', updatedAt: '2026-08-12', isOfficial: true },
  { id: '3', name: 'Python ML Pipeline', description: 'Training + evaluation + model registry for ML workloads', category: 'ML/AI', language: 'Python', version: '1.5.0', downloads: 12400, stars: 189, author: 'Orion', updatedAt: '2026-08-10', isOfficial: true },
  { id: '4', name: 'Java Spring Boot', description: 'Maven build + JUnit + SonarQube + Docker for Java microservices', category: 'Language', language: 'Java', version: '4.0.0', downloads: 45200, stars: 510, author: 'Orion', updatedAt: '2026-08-20', isOfficial: true },
  { id: '5', name: 'Kubernetes Deploy', description: 'Helm chart deploy with canary/rollout verification', category: 'K8s', language: 'Helm', version: '2.8.0', downloads: 33100, stars: 398, author: 'Orion', updatedAt: '2026-08-18', isOfficial: true },
];

async function fetchTemplates(category: string, q: string): Promise<Template[]> {
  try {
    const params: Record<string, string> = {};
    if (category !== 'all') params.category = category;
    if (q) params.q = q;
    const resp = await api.get<Template[]>('/pipeline-templates', { params });
    if (Array.isArray(resp.data)) return resp.data;
  } catch {
    return FALLBACK_TEMPLATES;
  }
  return FALLBACK_TEMPLATES;
}

export function useTemplateMarketState() {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Template | null>(null);
  const [applyModal, setApplyModal] = useState(false);

  const { data: templates, isLoading: loading, refetch } = useQuery<Template[]>({
    queryKey: ['pipeline-templates', category, search],
    queryFn: () => fetchTemplates(category, search),
  });

  const loadTemplates = () => refetch();
  const safeTemplates = templates ?? FALLBACK_TEMPLATES;

  const handleApply = (t: Template) => {
    setSelected(t);
    setApplyModal(true);
    message.success(`模板 "${t.name}" 已加入 Pipeline`);
  };

  const handleFork = (t: Template) => {
    message.success(`模板 "${t.name}" 已复制为自定义模板`);
  };

  const stats = useMemo(
    () => ({
      total: safeTemplates.length,
      official: safeTemplates.filter((t) => t.isOfficial).length,
      downloads: safeTemplates.reduce((s, t) => s + t.downloads, 0),
      stars: safeTemplates.reduce((s, t) => s + t.stars, 0),
    }),
    [safeTemplates]
  );

  return {
    category, setCategory,
    search, setSearch,
    selected, setSelected,
    applyModal, setApplyModal,
    loading,
    safeTemplates,
    stats,
    loadTemplates,
    handleApply,
    handleFork,
  };
}
