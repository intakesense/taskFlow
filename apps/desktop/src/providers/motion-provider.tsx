'use client';

import { LazyMotion, domAnimation } from 'framer-motion';
import type { ReactNode } from 'react';

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * Provides framer-motion features to child components.
 * Using LazyMotion with domAnimation for smaller bundle size.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}