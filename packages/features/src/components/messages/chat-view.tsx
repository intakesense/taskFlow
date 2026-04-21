'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import { m, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../../providers/auth-context';
import { useUsers } from '../../hooks/use-users';
import { useMentions } from '../../hooks/use-mentions';
import { useSetReaction, groupReactions, getUserReaction } from '../../hooks/use-reactions';
import { haptics } from '../../utils/haptics';
import { getLevelLabel } from '../../services/users';
import { ChatBubble } from '../chat/chat-bubble';
import { MentionPopup } from '../chat/mention-popup';
import { TypingBubble } from './typing-bubble';
import { OnlineStatusBadge, OnlineStatusDot } from './online-status-badge';
import { VoiceRecorder, AudioMessagePlayer } from './voice-recorder';
import { FileAttachment } from './file-attachment';
import { AttachMenu } from './attach-menu';
import type { DriveFile } from './drive-picker';
import { ProfilePictureDialog } from './profile-picture-dialog';
import { GroupSettingsDialog } from './group-settings-dialog';
import { MessageStatus } from './message-status';
import {
  cn,
  replyReferenceVariants,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Input,
  EmojiPicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@taskflow/ui';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Loader2,
  X,
  Mic,
  Settings,
  Paperclip,
} from 'lucide-react';
import type {
  ConversationWithMembers,
  MessageWithSender,
  UserBasic,
  User,
} from '@taskflow/core';

// Import FilePreview from the file-upload component (platform-specific)
// This component should be passed via renderFilePreview prop for flexibility
interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

interface ChatViewProps {
  conversation: ConversationWithMembers;
  messages: MessageWithSender[];
  typingUsers: UserBasic[];
  isUserOnline: (userId: string) => boolean;
  onSendMessage: (content: string, replyToId?: string) => void;
  onSendFile?: (file: File, replyToId?: string) => void | Promise<void>;
  onSendDriveFile?: (driveFile: DriveFile, messageId?: string) => void | Promise<void>;
  onBack?: () => void;
  onTyping?: () => void;
  isLoading?: boolean;
  isSending?: boolean;
  /** Optional chat pattern for background styling */
  chatPattern?: string;
  /** Render prop for file preview before sending */
  renderFilePreview?: (props: FilePreviewProps) => ReactNode;
}

export function ChatView({
  conversation,
  messages,
  typingUsers,
  isUserOnline,
  onSendMessage,
  onSendFile,
  onSendDriveFile,
  onBack,
  onTyping,
  isLoading,
  isSending,
  chatPattern = 'none',
  renderFilePreview,
}: ChatViewProps) {
  const { effectiveUser } = useAuth();
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFile | null>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [showProfilePicture, setShowProfilePicture] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{
    avatarUrl?: string | null;
    name: string;
    email?: string | null;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allUsers = [] } = useUsers();
  // Scope mentionable users to this conversation's members only
  const memberIds = new Set(conversation.members.map((m) => m.id));
  const mentionableUsers = allUsers.filter((u) => memberIds.has(u.id));
  const {
    mentionPopupOpen,
    filteredUsers,
    handleMentionInput,
    selectMention,
    closeMentionPopup,
  } = useMentions({ value: input, onChange: setInput, users: mentionableUsers, inputRef });
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const prevMentionOpenRef = useRef(false);
  const prevMentionListLenRef = useRef(0);
  if (!mentionPopupOpen) {
    if (prevMentionOpenRef.current) setMentionActiveIndex(0);
  } else if (filteredUsers.length !== prevMentionListLenRef.current) {
    setMentionActiveIndex(0);
  }
  prevMentionOpenRef.current = mentionPopupOpen;
  prevMentionListLenRef.current = filteredUsers.length;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when replying
  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleSend = () => {
    if (!input.trim() && !selectedFile && !selectedDriveFile) return;

    haptics.medium();

    const replyToId = replyingTo?.id;

    if (selectedFile && onSendFile) {
      onSendFile(selectedFile, replyToId);
      setSelectedFile(null);
    }

    if (selectedDriveFile && onSendDriveFile) {
      onSendDriveFile(selectedDriveFile);
      setSelectedDriveFile(null);
    }

    if (input.trim()) {
      onSendMessage(input.trim(), replyToId);
      setInput('');
    }

    setReplyingTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionPopupOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIndex((prev) =>
          Math.min(prev + 1, filteredUsers.length - 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredUsers[mentionActiveIndex]) {
          selectMention(filteredUsers[mentionActiveIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMentionPopup();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape' && replyingTo) {
      setReplyingTo(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleMentionInput(e.target.value);
    onTyping?.();
  };

  const handleSendVoiceMessage = async (audioBlob: Blob) => {
    if (!effectiveUser?.id || !conversation?.id) return;

    try {
      setIsSendingVoice(true);
      toast.loading('Uploading voice message...', { id: 'voice-upload' });

      const audioFile = new File([audioBlob], 'Voice Message.webm', {
        type: audioBlob.type || 'audio/webm',
      });

      if (onSendFile) {
        await onSendFile(audioFile, replyingTo?.id);
      }

      toast.success('Voice message sent', { id: 'voice-upload' });
      setShowVoiceRecorder(false);
      setReplyingTo(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send voice message';
      toast.error(message, { id: 'voice-upload' });
    } finally {
      setIsSendingVoice(false);
    }
  };

  const handleReply = useCallback((message: MessageWithSender) => {
    haptics.light();
    setReplyingTo(message);
  }, []);

  const handleEmojiSelect = (emoji: string) => {
    handleMentionInput(input + emoji);
    inputRef.current?.focus();
    onTyping?.();
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  const otherUser = conversation.members.find(
    (m) => m.id !== effectiveUser?.id
  );
  // Self-chat: only member is yourself
  const isSelfChat =
    !otherUser &&
    conversation.members.length === 1 &&
    conversation.members[0]?.id === effectiveUser?.id;
  const displayName = conversation.is_group
    ? conversation.name
    : isSelfChat
      ? 'You (Notes)'
      : otherUser?.name || 'Unknown';
  const hasContent = input.trim().length > 0 || selectedFile !== null || selectedDriveFile !== null;
  const showSendButton = hasContent || showVoiceRecorder;

  const currentUser = effectiveUser
    ? {
        id: effectiveUser.id,
        name: effectiveUser.name,
        email: effectiveUser.email,
        level: effectiveUser.level,
      }
    : null;

  const handleAvatarClick = useCallback(
    (avatarUrl: string | null | undefined, name: string, email: string | null | undefined) => {
      setSelectedProfile({ avatarUrl, name, email });
      setShowProfilePicture(true);
    },
    []
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border bg-card">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="lg:hidden h-9 w-9 flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div
          className="relative cursor-pointer flex-shrink-0"
          onClick={() => {
            haptics.light();
            if (conversation.is_group) {
              // Open group settings for groups
              setShowGroupSettings(true);
            } else {
              // Show profile picture for DMs
              setSelectedProfile({
                avatarUrl: isSelfChat
                  ? effectiveUser?.avatar_url
                  : otherUser?.avatar_url,
                name: displayName || 'Unknown',
                email: isSelfChat ? effectiveUser?.email : otherUser?.email,
              });
              setShowProfilePicture(true);
            }
          }}
        >
          <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
            {(() => {
              // For self-chat, use your own avatar
              const avatarUrl = conversation.is_group
                ? conversation.avatar_url
                : isSelfChat
                  ? effectiveUser?.avatar_url
                  : otherUser?.avatar_url;
              return avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName || 'Avatar'} />
              ) : null;
            })()}
            <AvatarFallback className="bg-primary text-primary-foreground">
              {displayName?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          {!conversation.is_group && otherUser && isUserOnline(otherUser.id) && (
            <OnlineStatusBadge
              isOnline={true}
              size="md"
              className="absolute bottom-0 right-0"
            />
          )}
        </div>
        <div
          className={cn(
            'flex-1 min-w-0',
            conversation.is_group && 'cursor-pointer'
          )}
          onClick={
            conversation.is_group
              ? () => {
                  haptics.light();
                  setShowGroupSettings(true);
                }
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">
              {displayName}
            </h3>
            {!conversation.is_group && otherUser && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 flex-shrink-0"
              >
                {getLevelLabel(otherUser.level)}
              </Badge>
            )}
          </div>
          {typingUsers.length > 0 ? (
            <p className="text-xs text-primary">
              {typingUsers.map((u) => u.name).join(', ')} typing...
            </p>
          ) : conversation.is_group ? (
            <p className="text-xs text-muted-foreground">
              {conversation.members.length} members - Tap for group info
            </p>
          ) : otherUser && isUserOnline(otherUser.id) ? (
            <p className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1.5">
              <OnlineStatusDot isOnline={true} size="sm" />
              Active now
            </p>
          ) : otherUser?.email ? (
            <p className="text-xs text-muted-foreground">{otherUser.email}</p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {conversation.is_group && (
              <DropdownMenuItem
                onClick={() => {
                  haptics.light();
                  setShowGroupSettings(true);
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Group settings
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div
        {...getRootProps()}
        data-pattern={chatPattern !== 'none' ? chatPattern : undefined}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2 relative',
          chatPattern !== 'none' && 'chat-pattern-bg',
          isDragActive && 'bg-primary/5'
        )}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary z-10 pointer-events-none">
            <div className="text-center">
              <Paperclip className="h-12 w-12 mx-auto mb-2 text-primary" />
              <p className="text-lg font-medium text-primary">Drop file to upload</p>
              <p className="text-sm text-muted-foreground">Max 10MB</p>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No messages yet. Say hi!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {messages.map((message) => (
              <MessageBubbleWrapper
                key={
                  (message as { _stableKey?: string })._stableKey || message.id
                }
                message={message}
                messages={messages}
                conversation={conversation}
                currentUserId={effectiveUser?.id || ''}
                currentUser={currentUser}
                isOwn={message.sender_id === effectiveUser?.id}
                onReply={handleReply}
                onAvatarClick={handleAvatarClick}
                users={allUsers}
              />
            ))}
            <TypingBubble key="typing" typingUsers={typingUsers} />
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      <AnimatePresence>
        {replyingTo && (
          <m.div
            variants={replyReferenceVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="px-3 sm:px-4 py-2 sm:py-3 border-t border-border bg-muted/50 flex items-center gap-2 sm:gap-3 overflow-hidden"
          >
            <div className="w-1 h-10 sm:h-12 bg-primary rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-primary truncate">
                Replying to {replyingTo.sender?.name || 'Unknown'}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {replyingTo.content ||
                  (replyingTo.file_name
                    ? `File: ${replyingTo.file_name}`
                    : 'Message')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 rounded-full touch-manipulation flex-shrink-0"
              onClick={() => {
                haptics.light();
                setReplyingTo(null);
              }}
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </m.div>
        )}
      </AnimatePresence>

      {/* Input */}
      {showVoiceRecorder ? (
        <div className="flex-shrink-0">
          <VoiceRecorder
            onSend={handleSendVoiceMessage}
            onCancel={() => setShowVoiceRecorder(false)}
            maxDuration={300}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 p-2 sm:p-4 border-t border-border bg-card">
          {selectedFile && renderFilePreview && (
            <div className="mb-2 sm:mb-3">
              {renderFilePreview({
                file: selectedFile,
                onRemove: () => setSelectedFile(null),
              })}
            </div>
          )}

          {selectedDriveFile && (
            <div className="mb-2 sm:mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border text-sm">
              {selectedDriveFile.iconUrl && (
                <img src={selectedDriveFile.iconUrl} alt="" className="h-5 w-5 shrink-0" />
              )}
              <span className="truncate flex-1">{selectedDriveFile.name}</span>
              <button
                onClick={() => setSelectedDriveFile(null)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 sm:gap-2">
            <EmojiPicker
              onEmojiSelect={handleEmojiSelect}
              disabled={isSending || isSendingVoice}
              position="top"
            />
            <AttachMenu
              disabled={isSending || isSendingVoice}
              onFileSelected={(file) => { haptics.light(); setSelectedFile(file); setSelectedDriveFile(null); }}
              onDriveFileSelected={(file) => { haptics.light(); setSelectedDriveFile(file); setSelectedFile(null); }}
            />
            <div className="flex-1 min-w-0 relative">
              <MentionPopup
                users={filteredUsers}
                open={mentionPopupOpen}
                activeIndex={mentionActiveIndex}
                onSelect={selectMention}
                onClose={closeMentionPopup}
              />
              <Input
                ref={inputRef}
                placeholder={
                  replyingTo
                    ? 'Reply...'
                    : selectedFile
                      ? 'Add a message (optional)...'
                      : 'Type a message...'
                }
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="flex-1 h-9 sm:h-11 rounded-full px-3 sm:px-4 text-[16px]"
                disabled={isSendingVoice}
              />
            </div>

            {showSendButton ? (
              <Button
                onClick={handleSend}
                disabled={
                  (!input.trim() && !selectedFile && !selectedDriveFile) || isSending || isSendingVoice
                }
                size="icon"
                title="Send"
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-full touch-manipulation flex-shrink-0"
              >
                {isSending || isSendingVoice ? (
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  haptics.light();
                  setShowVoiceRecorder(true);
                }}
                title="Record voice message"
                disabled={isSending || isSendingVoice}
                className="h-9 w-9 sm:h-11 sm:w-11 rounded-full touch-manipulation flex-shrink-0"
              >
                <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Profile Picture Dialog */}
      {selectedProfile && (
        <ProfilePictureDialog
          open={showProfilePicture}
          onOpenChange={(open) => {
            setShowProfilePicture(open);
            if (!open) {
              // Clear selected profile after dialog closes
              setTimeout(() => setSelectedProfile(null), 200);
            }
          }}
          avatarUrl={selectedProfile.avatarUrl}
          name={selectedProfile.name}
          email={selectedProfile.email}
        />
      )}

      {/* Group Settings Dialog */}
      {conversation.is_group && effectiveUser && (
        <GroupSettingsDialog
          open={showGroupSettings}
          onOpenChange={setShowGroupSettings}
          conversation={conversation}
          currentUserId={effectiveUser.id}
        />
      )}
    </div>
  );
}

// Message bubble wrapper that integrates with the conversation-specific logic
interface MessageBubbleWrapperProps {
  message: MessageWithSender;
  messages: MessageWithSender[];
  conversation: ConversationWithMembers;
  currentUserId: string;
  currentUser: UserBasic | null;
  isOwn: boolean;
  onReply: (message: MessageWithSender) => void;
  onAvatarClick?: (avatarUrl: string | null | undefined, name: string, email: string | null | undefined) => void;
  users?: User[];
}

function MessageBubbleWrapper({
  message,
  messages,
  conversation,
  currentUserId,
  currentUser,
  isOwn,
  onReply,
  onAvatarClick,
  users = [],
}: MessageBubbleWrapperProps) {
  const setReaction = useSetReaction();
  const groupedReactions = groupReactions(message.reactions, currentUserId);
  const userCurrentEmoji = getUserReaction(message.reactions, currentUserId);

  const handleReact = (emoji: string) => {
    if (!currentUser) return;
    setReaction.mutate({
      messageId: message.id,
      conversationId: message.conversation_id,
      emoji,
      userId: currentUserId,
      user: currentUser,
      currentEmoji: userCurrentEmoji || undefined,
    });
  };

  const handleReply = () => {
    onReply(message);
  };

  // File attachment render
  const renderFileAttachment = useCallback(
    (props: { fileUrl: string; fileName: string; fileType: string; fileSize?: number }) => (
      <FileAttachment
        fileUrl={props.fileUrl}
        fileName={props.fileName}
        fileType={props.fileType}
        fileSize={props.fileSize}
      />
    ),
    []
  );

  // Audio player render
  const renderAudioPlayer = useCallback(
    (props: { audioUrl: string; className?: string }) => (
      <AudioMessagePlayer audioUrl={props.audioUrl} className={props.className} />
    ),
    []
  );

  // Message status render (read receipts / ticks)
  const renderMessageStatus = useCallback(
    () => (
      <MessageStatus
        message={message}
        conversation={conversation}
        currentUserId={currentUserId}
      />
    ),
    [message, conversation, currentUserId]
  );

  return (
    <ChatBubble
      message={message}
      allMessages={messages}
      isOwn={isOwn}
      currentUser={currentUser}
      isGroupChat={conversation.is_group}
      showAvatar={conversation.is_group && !isOwn}
      showSenderName={conversation.is_group && !isOwn}
      users={users}
      onReact={handleReact}
      onReply={handleReply}
      onAvatarClick={onAvatarClick}
      groupedReactions={groupedReactions}
      userCurrentEmoji={userCurrentEmoji}
      renderFileAttachment={renderFileAttachment}
      renderAudioPlayer={renderAudioPlayer}
      renderMessageStatus={isOwn ? renderMessageStatus : undefined}
    />
  );
}
