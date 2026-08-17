/**
 * DependencyGraph Component
 * Visualizes module dependency relationships as a directed graph
 * Uses Ant Design Tree for hierarchical dependency display
 */
import React, { useMemo } from 'react';
import { Typography, Tag, Card, Empty, Tree } from 'antd';
import {
  ClusterOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import type { ModuleDescriptor } from '@/api/module-manager';
import { colors, spacing } from '@/tokens';

const { Text } = Typography;
const { TreeNode } = Tree;

// ============================================================================
// Types
// ============================================================================

interface DependencyGraphProps {
  modules: ModuleDescriptor[];
  /** If true, show reverse dependencies (what depends on me) */
  showReverseDeps?: boolean;
  /** Filter by module level */
  levelFilter?: string;
}

// ============================================================================
// Helpers
// ============================================================================

const stateIcon: Record<string, React.ReactNode> = {
  active: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  registered: <PauseCircleOutlined style={{ color: colors.neutral[400] }} />,
  starting: <WarningOutlined style={{ color: colors.warning[500] }} />,
  stopping: <WarningOutlined style={{ color: colors.warning[500] }} />,
  stopped: <CloseCircleOutlined style={{ color: colors.error[500] }} />,
  failed: <CloseCircleOutlined style={{ color: colors.error[500] }} />,
};

const levelColor: Record<string, string> = {
  core: colors.error[500],
  domain: colors.purple[500],
  service: colors.info[500],
  feature: colors.success[500],
};

const levelLabel: Record<string, string> = {
  core: '核心',
  domain: '域',
  service: '服务',
  feature: '特性',
};

/**
 * Build a tree structure from module dependencies.
 * Root nodes are modules with no dependencies (or core modules).
 */
function buildDependencyTree(
  modules: ModuleDescriptor[],
  showReverse: boolean
): React.ReactNode[] {
  const moduleMap = new Map<string, ModuleDescriptor>();
  modules.forEach((m) => moduleMap.set(m.id, m));

  if (showReverse) {
    // Reverse: show what each module is depended upon by
    const reverseDeps = new Map<string, string[]>();
    modules.forEach((m) => {
      m.config.dependencies?.forEach((dep) => {
        if (!reverseDeps.has(dep)) reverseDeps.set(dep, []);
        reverseDeps.get(dep)!.push(m.id);
      });
    });

    // Root = modules that have no dependents (leaf modules)
    const allDependedUpon = new Set(reverseDeps.keys());
    const rootModules = modules.filter((m) => !allDependedUpon.has(m.id));

    function renderReverseNode(moduleId: string): React.ReactNode {
      const mod = moduleMap.get(moduleId);
      if (!mod) return null;
      const dependents = reverseDeps.get(moduleId) || [];
      return (
        <TreeNode
          key={mod.id}
          title={
            <ModuleNodeTitle
              module={mod}
              suffix={
                dependents.length > 0 && (
                  <Tag color="cyan" style={{ marginLeft: spacing.sm }}>
                    {dependents.length} 依赖
                  </Tag>
                )
              }
            />
          }
        >
          {dependents.map((depId) => renderReverseNode(depId))}
        </TreeNode>
      );
    }

    return rootModules.map((m) => renderReverseNode(m.id));
  }

  // Normal: show what each module depends on
  const allDependencies = new Set<string>();
  modules.forEach((m) => {
    m.config.dependencies?.forEach((dep) => allDependencies.add(dep));
  });

  // Root = modules that have no dependencies (or are depended upon but don't depend)
  const rootModules = modules.filter(
    (m) => !m.config.dependencies || m.config.dependencies.length === 0
  );

  function renderNode(moduleId: string): React.ReactNode {
    const mod = moduleMap.get(moduleId);
    if (!mod) return null;
    const deps = mod.config.dependencies || [];
    return (
      <TreeNode
        key={mod.id}
        title={
          <ModuleNodeTitle
            module={mod}
            suffix={
              deps.length > 0 && (
                <Tag color="geekblue" style={{ marginLeft: spacing.sm }}>
                  {deps.length} 依赖
                </Tag>
              )
            }
          />
        }
      >
        {deps.map((depId) => renderNode(depId))}
      </TreeNode>
    );
  }

  return rootModules.map((m) => renderNode(m.id));
}

/** Render a single module node in the tree */
interface ModuleNodeTitleProps {
  module: ModuleDescriptor;
  suffix?: React.ReactNode;
}

function ModuleNodeTitle({ module, suffix }: ModuleNodeTitleProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
      {stateIcon[module.state] || null}
      <Text strong>{module.name}</Text>
      <Tag
        color={levelColor[module.level]}
        style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}
      >
        {levelLabel[module.level]}
      </Tag>
      {!module.config.enabled && (
        <Tag color="default" style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
          已禁用
        </Tag>
      )}
      {module.state === 'failed' && module.error && (
        <Tag color="red" style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
          错误
        </Tag>
      )}
      {suffix}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

const DependencyGraph: React.FC<DependencyGraphProps> = ({
  modules,
  showReverseDeps = false,
  levelFilter,
}) => {
  const filteredModules = useMemo(() => {
    if (!levelFilter || levelFilter === 'all') return modules;
    return modules.filter((m) => m.level === levelFilter);
  }, [modules, levelFilter]);

  const treeData = useMemo(
    () => buildDependencyTree(filteredModules, showReverseDeps),
    [filteredModules, showReverseDeps]
  );

  // Stats
  const stats = useMemo(() => {
    const levelCounts: Record<string, number> = {};
    const stateCounts: Record<string, number> = {};
    modules.forEach((m) => {
      levelCounts[m.level] = (levelCounts[m.level] || 0) + 1;
      stateCounts[m.state] = (stateCounts[m.state] || 0) + 1;
    });
    return { levelCounts, stateCounts };
  }, [modules]);

  if (modules.length === 0) {
    return <Empty description="暂无模块数据" />;
  }

  return (
    <Card
      title={
        <span>
          <ClusterOutlined style={{ marginRight: spacing.sm }} />
          依赖关系图 {showReverseDeps ? '(反向)' : ''}
        </span>
      }
      size="small"
    >
      {/* Stats summary */}
      <div style={{ marginBottom: spacing[3], display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
        {Object.entries(stats.levelCounts).map(([level, count]) => (
          <Tag key={level} color={levelColor[level]}>
            {levelLabel[level]}: {count}
          </Tag>
        ))}
        <span style={{ marginLeft: spacing.sm }}>
          <Text type="secondary">
            活跃: {stats.stateCounts.active || 0} | 已停止: {stats.stateCounts.stopped || 0} |
            失败: {stats.stateCounts.failed || 0}
          </Text>
        </span>
      </div>

      {/* Tree view */}
      <Tree
        defaultExpandAll
        showLine
        selectable={false}
        style={{ maxHeight: 500, overflow: 'auto' }}
      >
        {treeData}
      </Tree>
    </Card>
  );
};

export default DependencyGraph;
