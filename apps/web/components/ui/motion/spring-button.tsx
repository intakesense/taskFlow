'use client'

import { forwardRef, type ReactNode } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { type VariantProps } from 'class-variance-authority'
import { buttonVariants } from '@/components/ui/button'
import { springs } from '@/lib/animations'
import { cn } from '@/lib/utils'

interface SpringButtonProps extends VariantProps<typeof buttonVariants> {
  children?: ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

export const SpringButton = forwardRef<HTMLButtonElement, SpringButtonProps>(
  ({ className, variant, size, children, disabled, type = 'button', onClick }, ref) => {
    const prefersReducedMotion = useReducedMotion()

    if (prefersReducedMotion) {
      return (
        <button
          ref={ref}
          type={type}
          disabled={disabled}
          onClick={onClick}
          className={cn(buttonVariants({ variant, size, className }))}
        >
          {children}
        </button>
      )
    }

    return (
      <m.button
        ref={ref}
        type={type}
        disabled={disabled}
        onClick={onClick}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        transition={springs.micro}
        className={cn(buttonVariants({ variant, size, className }))}
      >
        {children}
      </m.button>
    )
  }
)

SpringButton.displayName = 'SpringButton'
