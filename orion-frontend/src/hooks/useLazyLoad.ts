/**
 * useLazyLoad Hook - 组件懒加载优化
 * 用于首屏渲染优化，按需加载可见区域组件
 *
 * Features:
 * - Intersection Observer API
 * - 低占位符支持
 * - 预加载配置
 * - 卸载清理
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseLazyLoadOptions {
  rootMargin?: string; // 根元素边距，如 "100px"
  threshold?: number; // 触发阈值 (0-1)
  placeholder?: React.ReactNode; // 占位内容
  preload?: boolean; // 是否预加载
}

export interface UseLazyLoadReturn {
  isLoaded: boolean;
  isInView: boolean;
  ref: React.RefObject<HTMLDivElement>;
  loading: boolean;
}

export const useLazyLoad = (
  onLoad?: () => void,
  options: UseLazyLoadOptions = {}
): UseLazyLoadReturn => {
  const {
    rootMargin = '100px',
    threshold = 0.01,
    preload = false,
  } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0];
      setIsInView(entry.isIntersecting);

      if (entry.isIntersecting && !isLoaded && !loading) {
        setLoading(true);
        // 模拟加载延迟（实际场景中可能是图片加载、组件加载等）
        setTimeout(() => {
          setLoading(false);
          setIsLoaded(true);
          onLoad?.();
        }, preload ? 100 : 0);
      }
    },
    [isLoaded, loading, onLoad, preload]
  );

  useEffect(() => {
    // 如果已加载，不需要继续观察
    if (isLoaded) {
      return;
    }

    const element = ref.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current && element) {
        observerRef.current.unobserve(element);
      }
    };
  }, [isLoaded, rootMargin, threshold, handleIntersection]);

  // 清理
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    isLoaded,
    isInView,
    ref,
    loading,
  };
};

export default useLazyLoad;
