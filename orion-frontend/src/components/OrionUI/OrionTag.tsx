import React from 'react';
import { Tag } from 'antd';
import type { OrionTagProps } from './types';

type TagColor = 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'gray';

const colorMap: Record<TagColor, string> = {
  green: 'green',
  orange: 'orange',
  red: 'red',
  blue: 'blue',
  purple: 'purple',
  gray: 'default',
} as const;

const OrionTag: React.FC<OrionTagProps> = ({ label, color }) => {
  const tagColor = color ? colorMap[color] : undefined;
  return <Tag color={tagColor}>{label}</Tag>;
};

export default OrionTag;
