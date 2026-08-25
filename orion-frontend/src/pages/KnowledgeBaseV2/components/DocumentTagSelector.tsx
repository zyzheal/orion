/**
 * DocumentTagSelector — Tag input for documents with create-on-type
 *
 * Features:
 *  - Select from existing space tags
 *  - Create new tags by typing (auto-create on blur/select)
 *  - Visual tag chips with remove button
 *  - Tag color support
 */

import React, { useState, useEffect, useRef } from 'react';
import { Select, Tag as AntTag, Space } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import { listTags, type TagInfo } from '@/api/pandawiki';

interface DocumentTagSelectorProps {
  spaceId: string;
  value?: string[];
  onChange?: (tags: string[]) => void;
  maxTags?: number;
  disabled?: boolean;
}

const TAG_COLORS = ['#f50', '#2db7f5', '#87d068', '#faad14', '#eb2f96', '#13c2c2', '#fa8c16'];

const DocumentTagSelector: React.FC<DocumentTagSelectorProps> = ({
  spaceId,
  value = [],
  onChange,
  maxTags = 10,
  disabled = false,
}) => {
  const [availableTags, setAvailableTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const loadCounterRef = useRef(0);

  useEffect(() => {
    const counter = ++loadCounterRef.current;
    const load = async () => {
      setLoading(true);
      try {
        const res = await listTags(spaceId);
        const data = res.data as TagInfo[] | { tags?: TagInfo[] };
        const list = Array.isArray(data) ? data : (data.tags ?? []) as TagInfo[];
        if (counter === loadCounterRef.current) setAvailableTags(list);
      } catch {
        if (counter === loadCounterRef.current) setAvailableTags([]);
      } finally {
        if (counter === loadCounterRef.current) setLoading(false);
      }
    };
    load();
  }, [spaceId]);

  const options = availableTags
    .filter((t) => !value.includes(t.name))
    .map((t) => ({
      label: (
        <Space>
          <AntTag color={t.color || TAG_COLORS[availableTags.indexOf(t) % TAG_COLORS.length]}>●</AntTag>
          <span>{t.name}</span>
          <span style={{ color: '#bfbfbf', fontSize: 11 }}>{t.documentCount || 0} 篇文档</span>
        </Space>
      ),
      value: t.name,
    }));

  return (
    <Select
      mode="tags"
      size="small"
      value={value}
      onChange={(v) => onChange?.(v)}
      options={options}
      disabled={disabled}
      loading={loading}
      maxTagCount={5}
      maxTagPlaceholder={(count) => `+${count} tags`}
      placeholder="选择或输入标签..."
      tokenSeparators={[',']}
      prefix={<TagOutlined style={{ color: colors.primary[500] }} />}
      style={{ width: '100%' }}
    />
  );
};

export default DocumentTagSelector;
