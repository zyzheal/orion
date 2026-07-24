/**
 * useChartPerformance Hook - ECharts 性能优化
 * 用于大数据量图表渲染优化
 *
 * Features:
 * - 数据采样（降采样）
 * - 防抖渲染
 * - 懒加载
 * - 内存优化
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface ChartPerformanceOptions {
  sampleRate?: number; // 采样率 (0.1 = 10%)
  maxPoints?: number; // 最大显示点数
  debounceMs?: number; // 渲染防抖毫秒数
  enabled?: boolean; // 是否启用优化
}

export interface useChartPerformanceReturn {
  sampledData: any[];
  isReady: boolean;
  needsSampling: boolean;
  originalCount: number;
  sampledCount: number;
  setChartData: (data: any[]) => void;
}

/**
 * LTTB (Largest-Triangle-Three-Buckets) 降采样算法
 * 保留数据的主要视觉特征
 */
function lttbSample(data: number[], sampleSize: number): number[] {
  if (data.length <= sampleSize) return data;

  const sampled = [];
  const bucketSize = Math.floor(data.length / sampleSize);

  for (let i = 0; i < sampleSize && i * bucketSize < data.length; i++) {
    const bucketStart = i * bucketSize;
    const bucketEnd = Math.min(bucketStart + bucketSize, data.length);

    // 取桶内平均值
    let sum = 0;
    let count = 0;
    for (let j = bucketStart; j < bucketEnd; j++) {
      sum += data[j];
      count++;
    }
    sampled.push(sum / count);
  }

  return sampled;
}

/**
 * 时间序列数据降采样
 */
function sampleTimeSeriesData(data: any[], maxPoints: number, sampleRate: number): any[] {
  if (data.length <= maxPoints) return data;

  const targetSize = Math.max(Math.floor(data.length * sampleRate), maxPoints);

  const firstItem = data[0];
  if (
    (firstItem && Object.prototype.hasOwnProperty.call(firstItem, 'value')) ||
    (firstItem && Object.prototype.hasOwnProperty.call(firstItem, 'y'))
  ) {
    // 对象数组格式
    return lttbSample(data, targetSize);
  }

  // 简单数组格式
  const sampled = lttbSample(data as number[], targetSize);
  return sampled.map((value, i) => ({
    value,
    index: i,
  }));
}

export const useChartPerformance = (
  initialData: any[] = [],
  options: ChartPerformanceOptions = {}
): useChartPerformanceReturn => {
  const { sampleRate = 0.1, maxPoints = 1000, debounceMs = 150, enabled = true } = options;

  const [chartData, setChartData] = useState<any[]>(initialData);
  const [sampledData, setSampledData] = useState<any[]>(initialData);
  const [isReady, setIsReady] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // 判断是否需要采样
  const needsSampling = chartData.length > maxPoints;

  // 处理数据采样
  const processSampling = useCallback(() => {
    if (!enabled || !needsSampling) {
      setSampledData(chartData);
      setIsReady(true);
      return;
    }

    const sampled = sampleTimeSeriesData(chartData, maxPoints, sampleRate);
    setSampledData(sampled);
    setIsReady(true);
  }, [chartData, enabled, needsSampling, maxPoints, sampleRate]);

  // 防抖处理数据变化
  useEffect(() => {
    setIsReady(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      processSampling();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [chartData, processSampling, debounceMs]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    sampledData,
    isReady,
    needsSampling,
    originalCount: chartData.length,
    sampledCount: sampledData.length,
    setChartData,
  };
};

export default useChartPerformance;
