import { useGSAP } from '@gsap/react';
import { tokens } from '@ie/design-tokens';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import type { RefObject } from 'react';

gsap.registerPlugin(useGSAP, CustomEase);

const { duration, ease } = tokens.motion;
// The motion tokens' cubic-bezier curves, registered once as named GSAP eases.
const [x1, y1, x2, y2] = ease.out;
CustomEase.create('ie-out', `M0,0 C${x1},${y1} ${x2},${y2} 1,1`);

/**
 * Subtle entrance for a page's direct children (opacity + 8 px rise, SRS §40.5). Scoped to the
 * container so useGSAP cleans up on unmount, and skipped entirely for reduced-motion users.
 */
export function useEnter(scope: RefObject<HTMLElement | null>): void {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from(scope.current?.children ?? [], {
          opacity: 0,
          y: 8,
          duration: duration.enter / 1000,
          ease: 'ie-out',
          stagger: 0.04,
          clearProps: 'opacity,transform',
        });
      });
      return () => mm.revert();
    },
    { scope },
  );
}
