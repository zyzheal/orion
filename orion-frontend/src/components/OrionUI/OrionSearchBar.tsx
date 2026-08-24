import React from 'react';
import { Input } from 'antd';
import type { OrionSearchBarProps } from './types';

/**
 * OrionSearchBar — 统一搜索栏
 * 内置防抖（默认 300ms），避免每次输入触发 API 调用
 */
const OrionSearchBar: React.FC<OrionSearchBarProps> = ({
  placeholder,
  onSearch,
  value,
  onChange,
  debounceMs = 300,
}) => {
  const [searchValue, setSearchValue] = React.useState(value ?? '');
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setSearchValue(value ?? '');
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setSearchValue(v);
      onChange?.(v);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch?.(v);
      }, debounceMs);
    },
    [onChange, onSearch, debounceMs],
  );

  return (
    <Input.Search
      placeholder={placeholder}
      allowClear
      onSearch={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        onSearch?.(searchValue);
      }}
      value={searchValue}
      onChange={handleChange}
      enterButton
    />
  );
};

export default OrionSearchBar;
