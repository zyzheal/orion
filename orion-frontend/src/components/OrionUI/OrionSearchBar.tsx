import React from 'react';
import { Input } from 'antd';
import type { OrionSearchBarProps } from './types';

const OrionSearchBar: React.FC<OrionSearchBarProps> = ({
  placeholder,
  onSearch,
  value,
  onChange,
}) => (
  <Input.Search
    placeholder={placeholder}
    allowClear
    onSearch={onSearch}
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    enterButton
  />
);

export default OrionSearchBar;
