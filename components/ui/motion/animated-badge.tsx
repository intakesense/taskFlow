'use client'

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { badgeVariants } from '@/lib/animations'
import { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface AnimatedBadgeProps {
  count: number
  className?: string
  max?: number
}

export function AnimatedBadge({ count, className, max = 99 }: AnimatedBadgeProps) {
  const prefersReducedMotion = useReducedMotion()
  const prevCountRef = useRef(count)
  const [shouldPulse, setShouldPulse] = useState(false)

  // Handle pulse animation in effect - properly structured to satisfy React Compiler
  useEffect(() => {
    // Only pulse if count increased and is greater than 0
    if (count > prevCountRef.current && count > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: trigger animation based on count change
      setShouldPulse(true)
      const timeout = setTimeout(() => setShouldPulse(false), 300)
      prevCountRef.current = count
      return () => clearTimeout(timeout)
    }
    // Always update the ref after checking
    prevCountRef.current = count
  }, [count])

  // Fallback for reduced motion or zero count
  if (prefersReducedMotion) {
    return count > 0 ? (
      <Badge className={cn('min-w-[22px] h-[22px] justify-center', className)}>
        {count > max ? `${max}+` : count}
      </Badge>
    ) : null
  }

  return (
    <AnimatePresence mode="wait">
      {count > 0 && (
        <motion.div
          key="badge"
          variants={badgeVariants}
          initial="initial"
          animate={shouldPulse ? 'pulse' : 'animate'}
          exit="exit"
        >
          <Badge className={cn('min-w-[22px] h-[22px] justify-center', className)}>
            {count > max ? `${max}+` : count}
          </Badge>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
