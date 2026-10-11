import { useEffect, useState } from 'react';

/**
 * useReducedMotion — P0-6 a11y 前置（reports/module-upgrade-designs/frontend-a11y-p0-prework-design-2026-10-11.md §7.2）
 *
 * 尊重用户的 prefers-reduced-motion 系统偏好，供动画密集组件使用。
 * 全局 CSS 已强制 0.01ms 动画时长（src/assets/styles/global.css:448），
 * 本 hook 用于组件级需要显式判断的动效（如跳过 CSS transition 类名）。
 *
 * @returns { boolean } true 表示用户偏好转减弱化动效，组件应避免动画。
 */
export function useReducedMotion(): boolean {
  const getReduced = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [prefersReduced, setPrefersReduced] = useState<boolean>(getReduced);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'undefined' === false) {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    // 同步初始状态（SSR 或首渲染时的 matchMedia 可能已经匹配）
    if (query.matches !== prefersReduced) {
      setPrefersReduced(query.matches);
    }
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return prefersReduced;
}

export default useReducedMotion;
