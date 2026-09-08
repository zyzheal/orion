/**
 * useSubAppsState.ts - SubApps 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 225)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenuConfigStore, type MenuChildConfig } from '@/stores/menuConfigStore';
import { iconMap, colorMap, defaultSubApps, type SubAppCard } from './constants';
import { CodeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';

export function useSubAppsState() {
  const navigate = useNavigate();
  const { modules, loadConfig } = useMenuConfigStore();
  const [subApps, setSubApps] = useState<SubAppCard[]>(defaultSubApps);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubApps = () => {
      try {
        loadConfig();
        const subAppsModule = modules['/subapps'];
        if (subAppsModule && subAppsModule.enabled && subAppsModule.children) {
          const enabledChildren = subAppsModule.children.filter((child) => child.enabled);
          if (enabledChildren.length > 0) {
            const mappedSubApps: SubAppCard[] = enabledChildren.map(
              (child: MenuChildConfig) => ({
                key: child.key.replace('/', ''),
                name: child.label,
                description: child.description || '',
                icon: iconMap[child.key] || <CodeOutlined />,
                color: colorMap[child.key] || colors.primary[500],
                path: child.key,
                tags: child.category ? [child.category] : [],
              })
            );
            setSubApps(mappedSubApps);
          }
        }
      } catch {
        // 降级使用默认列表
      } finally {
        setLoading(false);
      }
    };
    loadSubApps();
  }, [modules, loadConfig]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  return {
    subApps,
    loading,
    handleNavigate,
  };
}
