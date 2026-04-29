'use client'

import { useState, useRef, useEffect } from 'react'
import EmojiPickerReact, { Theme, EmojiClickData, Categories, EmojiStyle } from 'emoji-picker-react'
import { useTheme } from 'next-themes'
import { Button } from './button'
import { Smile } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobile } from '@taskflow/features'

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void
    disabled?: boolean
    className?: string
    buttonClassName?: string
    position?: 'top' | 'bottom'
}

export function EmojiPicker({
    onEmojiSelect,
    disabled,
    className,
    buttonClassName,
    position = 'top',
}: EmojiPickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const { resolvedTheme } = useTheme()
    const containerRef = useRef<HTMLDivElement>(null)
    const isMobile = useMobile(640) // sm breakpoint

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        onEmojiSelect(emojiData.emoji)
        setIsOpen(false)
    }

    // Close picker when clicking outside
    useEffect(() => {
        if (!isOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen])

    // Don't render on mobile - users have emoji keyboards built-in
    // Moved after all hooks to comply with rules-of-hooks
    if (isMobile) {
        return null
    }

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    'h-11 w-11 rounded-full touch-manipulation flex-shrink-0',
                    buttonClassName
                )}
                title="Add emoji"
            >
                <Smile className="h-5 w-5" />
            </Button>

            {isOpen && (
                <div
                    className={cn(
                        'absolute z-50',
                        position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                        'left-0'
                    )}
                >
                    <EmojiPickerReact
                        onEmojiClick={handleEmojiClick}
                        theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
                        emojiStyle={EmojiStyle.NATIVE}
                        width={320}
                        height={400}
                        searchPlaceholder="Search emoji..."
                        previewConfig={{
                            showPreview: false,
                        }}
                        categories={[
                            { category: Categories.SUGGESTED, name: 'Recent' },
                            { category: Categories.SMILEYS_PEOPLE, name: 'Smileys' },
                            { category: Categories.ANIMALS_NATURE, name: 'Animals' },
                            { category: Categories.FOOD_DRINK, name: 'Food' },
                            { category: Categories.TRAVEL_PLACES, name: 'Travel' },
                            { category: Categories.ACTIVITIES, name: 'Activities' },
                            { category: Categories.OBJECTS, name: 'Objects' },
                            { category: Categories.SYMBOLS, name: 'Symbols' },
                            { category: Categories.FLAGS, name: 'Flags' },
                        ]}
                        skinTonesDisabled
                    />
                </div>
            )}
        </div>
    )
}
