'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { fadeInVariants } from '@/lib/animations'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export const FadeIn = forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, className, delay = 0 }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    if (prefersReducedMotion) {
      return (
        <div ref={ref} className={className}>
          {children}
        </div>
      )
    }

    return (
      <motion.div
        ref={ref}
        className={cn(className)}
        variants={fadeInVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ delay }}
      >
        {children}
      </motion.div>
    )
  }
)

FadeIn.displayName = 'FadeIn'
