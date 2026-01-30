'use client'

import { LazyMotion, domAnimation } from 'framer-motion'
import { type ReactNode } from 'react'

interface MotionProviderProps {
  children: ReactNode
}

// Using LazyMotion with domAnimation for smaller bundle size (~13kb vs ~30kb)
// This includes: animate, exit, variants, whileHover, whileTap, layout
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
