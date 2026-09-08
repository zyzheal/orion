import { useState } from 'react';
import { Progress, Tag, Text } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@/providers/QueryProvider';
import type { HallucinationRecord } from './types';
import { fetchHallucinationData } from './constants';

export function useHallucinationRateState() {
  const [period, setPeriod] = useState('7d');

  const { data: records, isLoading: loading, refetch } = useQuery<HallucinationRecord[]>({
    queryKey: ['ai-hallucination', period],
    queryFn: () => fetchHallucinationData(period),
  });

  const loadData = () => refetch();

  const total = records?.length ?? 0;
  const hallucinated = records?.filter((r) => r.hallucinated).length ?? 0;
  const rate = total > 0 ? Math.round((hallucinated / total) * 100) : 0;
  const avgConfidence = total > 0 ? Math.round((records!.reduce((s, r) => s + r.confidence, 0) / total) * 100) / 100 : 0;
  const criticalCount = records?.filter((r) => r.confidence < 0.5 && r.hallucinated).length ?? 0;

  const columns: ColumnsType<HallucinationRecord> = [
    { title: '模型', dataIndex: 'model', key: 'model', width: 120, render: (v: string) => <Text code>{v}</Text> },
    { title: '提示词', dataIndex: 'prompt', key: 'prompt', ellipsis: true, width: 220 },
    { title: '响应摘要', dataIndex: 'response', key: 'response', ellipsis: true, width: 220 },
    {
      title: '幻觉', dataIndex: 'hallucinated', key: 'hallucinated', width: 80,
      render: (v: boolean) => <Tag color={v ? 'error' : 'success'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '置信度', dataIndex: 'confidence', key: 'confidence', width: 120,
      render: (v: number) => <Progress type="circle" size={28} percent={Math.round(v * 100)} format={() => `${v}`} />,
    },
    { title: '类别', dataIndex: 'category', key: 'category', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '检测方式', dataIndex: 'detectedBy', key: 'detectedBy', width: 120 },
    { title: '时间', dataIndex: 'detectedAt', key: 'detectedAt', width: 160 },
  ];

  return {
    period, setPeriod, records, loading, loadData,
    total, hallucinated, rate, avgConfidence, criticalCount,
    columns,
  };
}

export type HallucinationRateState = ReturnType<typeof useHallucinationRateState>;
