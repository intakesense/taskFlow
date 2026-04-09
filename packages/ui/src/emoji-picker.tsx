'use client'

import { useState, useRef, useEffect } from 'react'
import EmojiPickerReact, { Theme, EmojiClickData, Categories, EmojiStyle } from 'emoji-picker-react'
import { Button } from './button'
import { Smile } from 'lucide-react'
import { cn } from './lib/utils'

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void
    disabled?: boolean
    className?: string
    buttonClassName?: string
    position?: 'top' | 'bottom'
    theme?: 'light' | 'dark'
    /** Hide on mobile (users have native emoji keyboards) */
    hideOnMobile?: boolean
}

export function EmojiPicker({
    onEmojiSelect,
    disabled,
    className,
    buttonClassName,
    position = 'top',
    theme = 'light',
    hideOnMobile = true,
}: EmojiPickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Check if mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

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

    if (hideOnMobile && isMobile) {
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
                        theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
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
