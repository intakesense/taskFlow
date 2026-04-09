'use client'

import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import { listContainerVariants, listItemVariants } from '@/lib/animations'
import { forwardRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedListProps {
  children: ReactNode
  className?: string
  mode?: 'wait' | 'sync' | 'popLayout'
}

export const AnimatedList = forwardRef<HTMLDivElement, AnimatedListProps>(
  ({ children, className, mode = 'popLayout' }, ref) => {
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
        variants={listContainerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <AnimatePresence mode={mode}>{children}</AnimatePresence>
      </motion.div>
    )
  }
)

AnimatedList.displayName = 'AnimatedList'

// Individual list item wrapper
interface AnimatedListItemProps {
  children: ReactNode
  className?: string
  layoutId?: string
  custom?: unknown
  variants?: Variants
}

export const AnimatedListItem = forwardRef<HTMLDivElement, AnimatedListItemProps>(
  ({ children, className, layoutId, custom, variants = listItemVariants }, ref) => {
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
        layoutId={layoutId}
        custom={custom}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        whileHover="hover"
      >
        {children}
      </motion.div>
    )
  }
)

AnimatedListItem.displayName = 'AnimatedListItem'
