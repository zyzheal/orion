export interface OrionStatisticProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
}

export interface OrionTagProps {
  label: string;
  color?: 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'gray';
}

export interface OrionEmptyProps {
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface OrionActionGroupItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  /** 按钮 loading 状态，修复重复点击问题 */
  loading?: boolean;
  /** 额外禁用条件 */
  disabled?: boolean;
}

export interface OrionActionGroupProps {
  items: OrionActionGroupItem[];
}

export interface OrionSearchBarProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  value?: string;
  onChange?: (value: string) => void;
  /** 防抖间隔(ms)，默认 300ms */
  debounceMs?: number;
}
