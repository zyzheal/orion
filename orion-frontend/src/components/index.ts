/**
 * Orion Shared Component Library
 *
 * Barrel exports for all shared components.
 * Import individual components or use the full library:
 *
 * ```tsx
 * // Individual imports (recommended for tree-shaking)
 * import { Table } from '@/components';
 * import { StatusBadge } from '@/components';
 *
 * // Or import specific component files
 * import Table from '@/components/Table';
 * ```
 */

// Base Components
export { default as Table } from './Table';
export type {
  TableColumn,
  TablePagination,
  OrionTableProps,
} from './Table';

export { default as Form } from './Form';
export type { FormField, FieldType, OrionFormProps } from './Form';

export { default as Modal } from './Modal';
export type { ModalType, OrionModalProps } from './Modal';

// Business Components
export { default as StatusBadge } from './StatusBadge';
export type { StatusBadgeProps, StatusType } from './StatusBadge';

export { default as Timeline } from './Timeline';
export type { TimelineEvent, TimelineProps } from './Timeline';

export { default as MetricCard } from './MetricCard';
export type { MetricCardProps, TrendDirection } from './MetricCard';

export { default as SearchFilterBar } from './SearchFilterBar';
export type {
  FilterOption,
  FilterDefinition,
  SearchFilterBarProps,
} from './SearchFilterBar';

// Layout Components
export { default as PageLayout } from './PageLayout';
export type { PageLayoutProps } from './PageLayout';

export { default as DashboardLayout } from './DashboardLayout';
export type { DashboardLayoutProps } from './DashboardLayout';

export { default as CardPanel } from './CardPanel';
export type { CardPanelProps } from './CardPanel';

export { default as SplitPane } from './SplitPane';
export type { SplitPaneProps, SplitDirection } from './SplitPane';

export { default as PageSkeleton } from './PageSkeleton';
export type { PageSkeletonProps } from './PageSkeleton';
