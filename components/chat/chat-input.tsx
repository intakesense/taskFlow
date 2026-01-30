'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, Paperclip, Mic, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { haptics } from '@/lib/haptics'
import { EmojiPicker } from '@/components/ui/emoji-picker'
import { VoiceRecorder } from '@/components/messages/voice-recorder'
import type { ChatInputProps } from './types'

/**
 * Shared ChatInput component for message composition.
 * Features are enabled/disabled via callback props.
 */
export function ChatInput({
    value,
    onChange,
    onSend,
    onTyping,
    placeholder = 'Type a message...',
    disabled = false,
    isSending = false,
    onFileSelect,
    onVoiceMessage,
    onEmojiSelect,
    replyingTo,
    onCancelReply,
    className,
}: ChatInputProps) {
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isSendingVoice, setIsSendingVoice] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const hasContent = value.trim().length > 0 || selectedFile !== null
    const showSendButton = hasContent || showVoiceRecorder

    const handleSend = useCallback(() => {
        if (!value.trim() && !selectedFile) return
        haptics.medium()

        if (selectedFile && onFileSelect) {
            onFileSelect(selectedFile)
            setSelectedFile(null)
        }

        if (value.trim()) {
            onSend()
        }
    }, [value, selectedFile, onFileSelect, onSend])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
        if (e.key === 'Escape' && replyingTo) {
            onCancelReply?.()
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value)
        onTyping?.()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
        }
        e.target.value = ''
    }

    const handleEmojiSelect = (emoji: string) => {
        onChange(value + emoji)
        onEmojiSelect?.(emoji)
        inputRef.current?.focus()
        onTyping?.()
    }

    const handleSendVoiceMessage = async (audioBlob: Blob) => {
        if (!onVoiceMessage) return

        try {
            setIsSendingVoice(true)
            await onVoiceMessage(audioBlob)
            setShowVoiceRecorder(false)
        } finally {
            setIsSendingVoice(false)
        }
    }

    return (
        <div className={cn('flex-shrink-0 border-t bg-card', className)}>
            {/* Reply preview */}
            {replyingTo && (
                <div className="px-4 pt-2 pb-1 flex items-center gap-2 border-b bg-muted/30">
                    <div className="flex-1 min-w-0 px-3 py-1 border-l-2 border-primary">
                        <p className="text-xs font-medium text-primary truncate">
                            Replying to {replyingTo.senderName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                            {replyingTo.content || (replyingTo.fileName ? `File: ${replyingTo.fileName}` : 'Message')}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={onCancelReply}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Selected file preview */}
            {selectedFile && (
                <div className="px-4 pt-2 pb-1 flex items-center gap-2 border-b">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => setSelectedFile(null)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Voice recorder */}
            {showVoiceRecorder && onVoiceMessage ? (
                <div className="px-4 py-3">
                    <VoiceRecorder
                        onSend={handleSendVoiceMessage}
                        onCancel={() => setShowVoiceRecorder(false)}
                        isSending={isSendingVoice}
                    />
                </div>
            ) : (
                <div className="flex items-center gap-2 px-4 py-3">
                    {/* Emoji picker */}
                    {onEmojiSelect && (
                        <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                    )}

                    {/* File attachment button */}
                    {onFileSelect && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 flex-shrink-0 text-muted-foreground"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={disabled}
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>
                        </>
                    )}

                    {/* Text input */}
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            disabled={disabled}
                            className="w-full h-10 px-4 rounded-full bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {/* Voice/Send button */}
                    {showSendButton ? (
                        <Button
                            size="icon"
                            className="h-10 w-10 rounded-full flex-shrink-0"
                            onClick={handleSend}
                            disabled={disabled || isSending || !hasContent}
                        >
                            {isSending ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Send className="h-5 w-5" />
                            )}
                        </Button>
                    ) : onVoiceMessage ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full flex-shrink-0 text-muted-foreground"
                            onClick={() => setShowVoiceRecorder(true)}
                            disabled={disabled}
                        >
                            <Mic className="h-5 w-5" />
                        </Button>
                    ) : (
                        <Button
                            size="icon"
                            className="h-10 w-10 rounded-full flex-shrink-0"
                            disabled
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
