"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadAnimation = () => import("./motionFeatures").then((mod) => mod.domAnimation);
const loadMax = () => import("./motionFeatures").then((mod) => mod.domMax);

/**
 * Every animated element is motion's slim `m` component (imported as `motion`), and the animation features arrive
 * in their own chunk once the page has loaded. `layout` adds shared-layout animations, which only the landing page
 * uses. `strict` makes a stray full `motion` component fail loudly.
 */
export function MotionProvider({ layout = false, children }: { layout?: boolean; children: ReactNode }) {
  return (
    <LazyMotion features={layout ? loadMax : loadAnimation} strict>
      {children}
    </LazyMotion>
  );
}
