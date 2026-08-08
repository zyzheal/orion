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

export interface OrionActionGroupProps {
  items: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }>;
}

export interface OrionSearchBarProps {
  placeholder?: string;
  onSearch?: (value: string) => void;
  value?: string;
  onChange?: (value: string) => void;
}
