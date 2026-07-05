import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from '../panel.module.css';

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * One-shot scroll reveal: the block fades and rises the first time it enters the
 * viewport, then stays put. Falls back to immediately visible when the user prefers
 * reduced motion or IntersectionObserver is unavailable (e.g. jsdom in tests).
 */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // Trigger slightly before the block fully clears the fold so the rise reads
      // as a response to scrolling, not a late pop-in.
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div ref={ref} className={shown ? styles.revealShown : styles.reveal}>
      {children}
    </div>
  );
}
