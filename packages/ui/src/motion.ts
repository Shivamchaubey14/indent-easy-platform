import { useGSAP } from '@gsap/react';
import { tokens } from '@ie/design-tokens';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import type { RefObject } from 'react';

gsap.registerPlugin(useGSAP, CustomEase);

const { duration, ease } = tokens.motion;
const curve = ([x1, y1, x2, y2]: readonly number[]) => `M0,0 C${x1},${y1} ${x2},${y2} 1,1`;
// The motion tokens' cubic-bezier curves, registered once as named GSAP eases.
CustomEase.create('ie-out', curve(ease.out));
CustomEase.create('ie-in', curve(ease.in));

/** Durations in seconds (GSAP's unit) and ease names, all from the motion tokens (SRS §40.5). */
export const motion = {
  enter: duration.enter / 1000,
  exit: duration.exit / 1000,
  highlight: duration.highlight / 1000,
  easeOut: 'ie-out',
  easeIn: 'ie-in',
} as const;

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/** True when the user asked for less motion, or when the environment can't tell us. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia(MOTION_OK).matches;
}

/**
 * Subtle entrance for a page's direct children (opacity + 8 px rise). Scoped to the container so
 * useGSAP cleans up on unmount, and skipped entirely for reduced-motion users.
 */
export function useEnter(scope: RefObject<HTMLElement | null>): void {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(scope.current?.children ?? [], {
          opacity: 0,
          y: 8,
          duration: motion.enter,
          ease: motion.easeOut,
          stagger: 0.04,
          clearProps: 'opacity,transform',
        });
      });
      return () => mm.revert();
    },
    { scope },
  );
}
