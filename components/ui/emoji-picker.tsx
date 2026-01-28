'use client'

import { useState, useRef, useEffect } from 'react'
import EmojiPickerReact, { Theme, EmojiClickData, Categories, EmojiStyle } from 'emoji-picker-react'
import { useTheme } from 'next-themes'
import { Button } from './button'
import { Smile, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobile } from '@/hooks/use-mobile'

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
        // Don't close on mobile so users can select multiple emojis
        if (!isMobile) {
            setIsOpen(false)
        }
    }

    // Close picker when clicking outside (desktop only)
    useEffect(() => {
        if (!isOpen || isMobile) return

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, isMobile])

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

    // Prevent body scroll when mobile picker is open
    useEffect(() => {
        if (isMobile && isOpen) {
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = ''
            }
        }
    }, [isMobile, isOpen])

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
                <>
                    {isMobile ? (
                        // Mobile: Full-screen overlay from bottom (WhatsApp style)
                        <div className="fixed inset-0 z-50 flex flex-col">
                            {/* Backdrop */}
                            <div
                                className="flex-1 bg-black/50 backdrop-blur-sm"
                                onClick={() => setIsOpen(false)}
                            />

                            {/* Emoji picker panel */}
                            <div className="bg-background border-t border-border rounded-t-2xl animate-in slide-in-from-bottom duration-200">
                                {/* Handle bar */}
                                <div className="flex items-center justify-center py-2">
                                    <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
                                </div>

                                {/* Header with close button */}
                                <div className="flex items-center justify-between px-4 pb-2">
                                    <h3 className="font-medium text-foreground">Emoji</h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsOpen(false)}
                                        className="h-8 w-8 rounded-full"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Emoji picker */}
                                <div className="px-2 pb-safe">
                                    <EmojiPickerReact
                                        onEmojiClick={handleEmojiClick}
                                        theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
                                        emojiStyle={EmojiStyle.NATIVE}
                                        width="100%"
                                        height={350}
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
                            </div>
                        </div>
                    ) : (
                        // Desktop: Popover style
                        <div
                            className={cn(
                                'absolute z-50',
                                position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                                'right-0 sm:right-auto sm:left-0'
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
                </>
            )}
        </div>
    )
}
