import { useState, useCallback, useEffect } from 'react';

export function useAutoScroll(
  containerRef: React.RefObject<HTMLDivElement>,
  options?: { threshold?: number }
) {
  const threshold = options?.threshold ?? 50;
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const isNearBottom = useCallback((el: HTMLDivElement) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, [threshold]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const near = isNearBottom(el);
      setShowScrollButton(!near);
      if (near) setAutoScroll(true);
      else setAutoScroll(false);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [containerRef, isNearBottom]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  }, [containerRef]);

  const scrollToBottomIfAuto = useCallback(() => {
    if (autoScroll) scrollToBottom();
  }, [autoScroll, scrollToBottom]);

  return { autoScroll, showScrollButton, scrollToBottomIfAuto, scrollToBottom };
}
