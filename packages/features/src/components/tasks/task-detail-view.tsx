'use client';

// Task Detail View - Pure presentational component
import { useState } from 'react';
import type {
  TaskWithUsers,
  TaskMessageWithSender,
  TaskNoteWithAuthor,
  TaskAuditLogWithUser,
  Visibility,
  TaskStatus,
  TaskPriority,
} from '@taskflow/core';
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  VISIBILITY_LABELS,
} from '@taskflow/core';
import { formatDateTime, formatRelative } from '@taskflow/core';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ScrollArea,
  Separator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@taskflow/ui';
import {
  ArrowLeft,
  Send,
  Calendar,
  User,
  Users,
  Clock,
  CheckCircle2,
  PauseCircle,
  Play,
  Trash2,
  StickyNote,
  MessageSquare,
  Paperclip,
  ExternalLink,
  Eye,
  Pencil,
  ClockArrowUp,
  RotateCcw,
  History,
} from 'lucide-react';
import { NavigationLink } from '../primitives';
import { StackedAvatars } from './stacked-avatars';
import { TaskActivityFeed } from './task-activity-feed';
import { MultiUserSelector } from './multi-user-selector';
import { AttachMenu } from '../messages/attach-menu';
import type { DriveFile } from '../messages/drive-picker';
import type { UseDialogReturn } from '../../hooks/use-dialog';

interface TaskDetailViewProps {
  task: TaskWithUsers;
  messages: TaskMessageWithSender[];
  notes: TaskNoteWithAuthor[];
  isAssigner: boolean;
  isAssignee: boolean;
  isParticipant: boolean;
  newMessage: string;
  setNewMessage: (value: string) => void;
  newNote: string;
  setNewNote: (value: string) => void;
  noteVisibleTo: string[];
  setNoteVisibleTo: (value: string[]) => void;
  onHoldReason: string;
  setOnHoldReason: (value: string) => void;
  deleteDialog: UseDialogReturn;
  onHoldDialog: UseDialogReturn;
  requestChangesDialog: UseDialogReturn;
  requestChangesReason: string;
  setRequestChangesReason: (value: string) => void;
  auditLog: TaskAuditLogWithUser[];
  sendingMessage: boolean;
  addingNote: boolean;
  updatingStatus: boolean;
  deleting: boolean;
  onSendMessage: () => void;
  onAddNote: () => void;
  onStatusChange: (status: string) => void;
  onOnHoldConfirm: () => void;
  onRequestChangesConfirm: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onUpdateAssignees: (userIds: string[]) => void;
  updatingAssignees: boolean;
  // Drive attachments
  driveAttachments?: DriveFile[]
  onAttachDriveFile?: (file: DriveFile) => void | Promise<void>
}

export function TaskDetailView({
  task,
  messages,
  notes,
  isAssigner,
  isAssignee,
  isParticipant: _,
  newMessage,
  setNewMessage,
  newNote,
  setNewNote,
  noteVisibleTo,
  setNoteVisibleTo,
  onHoldReason,
  setOnHoldReason,
  deleteDialog,
  onHoldDialog,
  requestChangesDialog,
  requestChangesReason,
  setRequestChangesReason,
  auditLog,
  sendingMessage,
  addingNote,
  updatingStatus,
  deleting,
  onSendMessage,
  onAddNote,
  onStatusChange,
  onOnHoldConfirm,
  onRequestChangesConfirm,
  onDelete,
  onArchive,
  onUpdateAssignees,
  updatingAssignees,
  driveAttachments = [],
  onAttachDriveFile,
}: TaskDetailViewProps) {
  const [isEditingAssignees, setIsEditingAssignees] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    task.assignees?.map((a) => a.id) || []
  );
  const statusConfig = STATUS_CONFIG[task.status as TaskStatus];
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <NavigationLink
          href="/tasks"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </NavigationLink>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
              <Badge variant="secondary" className={priorityConfig.badgeColor}>
                {priorityConfig.label} priority
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{task.title}</h1>
            {task.status === 'completed' && (
              <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <ClockArrowUp className="h-4 w-4 shrink-0" />
                {isAssigner
                  ? 'This task is awaiting your review. Accept it or request changes.'
                  : 'Marked as done — waiting for the creator to review.'}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* ── Assignee actions ──────────────────────────────────── */}
            {isAssignee && task.status === 'pending' && (
              <Button onClick={() => onStatusChange('in_progress')} disabled={updatingStatus}>
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            )}

            {isAssignee && task.status === 'in_progress' && (
              <>
                {/* Mark as Done — triggers review flow */}
                <Button
                  onClick={() => onStatusChange('completed')}
                  disabled={updatingStatus}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Done
                </Button>

                {/* On Hold */}
                <Dialog open={onHoldDialog.open} onOpenChange={onHoldDialog.toggleDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <PauseCircle className="h-4 w-4 mr-2" />
                      On Hold
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Put Task On Hold</DialogTitle>
                      <DialogDescription>
                        Let the creator know why work is paused.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="e.g. Waiting for design approval..."
                      value={onHoldReason}
                      onChange={(e) => setOnHoldReason(e.target.value)}
                      className="min-h-[80px]"
                      autoFocus
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={onHoldDialog.closeDialog}>Cancel</Button>
                      <Button onClick={onOnHoldConfirm} disabled={!onHoldReason.trim()}>Confirm</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {isAssignee && task.status === 'on_hold' && (
              <Button onClick={() => onStatusChange('in_progress')} disabled={updatingStatus}>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}

            {/* ── Creator review actions (when assignee marked done) ── */}
            {isAssigner && task.status === 'completed' && (
              <>
                <Button
                  onClick={onArchive}
                  disabled={updatingStatus}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept
                </Button>

                <Dialog open={requestChangesDialog.open} onOpenChange={requestChangesDialog.toggleDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={updatingStatus}>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Request Changes
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Changes</DialogTitle>
                      <DialogDescription>
                        Tell the assignee what needs to be revised. This will reopen the task and post your feedback as a message.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Describe what needs to be changed..."
                      value={requestChangesReason}
                      onChange={(e) => setRequestChangesReason(e.target.value)}
                      className="min-h-[100px]"
                      autoFocus
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={requestChangesDialog.closeDialog}>Cancel</Button>
                      <Button onClick={onRequestChangesConfirm} disabled={!requestChangesReason.trim() || updatingStatus}>
                        Send Feedback
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* ── Creator: direct complete (in_progress, no review needed) ── */}
            {isAssigner && task.status === 'in_progress' && !isAssignee && (
              <Button onClick={onArchive} disabled={updatingStatus}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete
              </Button>
            )}

            {/* ── Creator: reopen archived task ── */}
            {isAssigner && task.status === 'archived' && (
              <Button onClick={() => onStatusChange('in_progress')} disabled={updatingStatus} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                Reopen
              </Button>
            )}

            {/* ── Creator: delete ── */}
            {isAssigner && task.status !== 'archived' && (
              <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.toggleDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Task</DialogTitle>
                    <DialogDescription>This action cannot be undone.</DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={deleteDialog.closeDialog}>Cancel</Button>
                    <Button variant="destructive" onClick={onDelete} disabled={deleting}>Delete</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {/* Task Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card data-slot="card">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned by</p>
                  <p className="font-medium">{task.assigner?.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Assigned to</p>
                    {isAssigner && task.status !== 'archived' && !isEditingAssignees && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setSelectedAssigneeIds(task.assignees?.map((a) => a.id) || []);
                          setIsEditingAssignees(true);
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {isEditingAssignees ? (
                    <div className="mt-2 space-y-3">
                      <MultiUserSelector
                        selectedUserIds={selectedAssigneeIds}
                        onSelectUsers={setSelectedAssigneeIds}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAssigneeIds(task.assignees?.map((a) => a.id) || []);
                            setIsEditingAssignees(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={updatingAssignees || selectedAssigneeIds.length === 0}
                          onClick={() => {
                            onUpdateAssignees(selectedAssigneeIds);
                            setIsEditingAssignees(false);
                          }}
                        >
                          {updatingAssignees ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : task.assignees && task.assignees.length > 0 ? (
                    <div className="flex items-center gap-2 mt-1">
                      <StackedAvatars users={task.assignees} max={4} size="sm" />
                      <span className="font-medium text-sm">
                        {task.assignees.length === 1
                          ? task.assignees[0].name
                          : `${task.assignees.length} people`}
                      </span>
                    </div>
                  ) : (
                    <p className="font-medium text-muted-foreground">Unassigned</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-slot="card">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{formatRelative(task.created_at)}</p>
                </div>
              </div>
              {task.deadline && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="font-medium">{formatDateTime(task.deadline)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-slot="card">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Visibility</p>
                <p className="font-medium">{VISIBILITY_LABELS[task.visibility as Visibility]}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {task.description && (
        <Card className="mb-6" data-slot="card">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-4 w-4 mr-2" />
            Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="attachments">
            <Paperclip className="h-4 w-4 mr-2" />
            Files ({driveAttachments.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card data-slot="card">
            <CardContent className="p-6">
              <ScrollArea className="h-[400px] pr-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="mb-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{msg.sender?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(msg.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
              <Separator className="my-4" />
              <div className="flex gap-2 items-center">
                {onAttachDriveFile && (
                  <AttachMenu
                    disabled={sendingMessage}
                    onFileSelected={() => { /* local file upload not supported in task messages */ }}
                    onDriveFileSelected={(file) => { onAttachDriveFile(file) }}
                  />
                )}
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSendMessage()}
                />
                <Button onClick={onSendMessage} disabled={sendingMessage || !newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card data-slot="card">
            <CardContent className="p-6">
              <ScrollArea className="h-[400px] pr-4 mb-4">
                {notes.map((note) => (
                  <div key={note.id} className="mb-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{note.author?.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {note.visible_to?.length > 0 ? (
                          <>
                            <Users className="h-3 w-3 mr-1" />
                            {note.visible_to.length} specific {note.visible_to.length === 1 ? 'person' : 'people'}
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            All participants
                          </>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </ScrollArea>
              <Separator className="my-4" />
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Visible to — leave empty for all task participants
                  </p>
                  <MultiUserSelector
                    selectedUserIds={noteVisibleTo}
                    onSelectUsers={setNoteVisibleTo}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={onAddNote} disabled={addingNote || !newNote.trim()}>
                    Add Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <Card data-slot="card">
            <CardContent className="p-6">
              {driveAttachments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Paperclip className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No files attached yet</p>
                  {onAttachDriveFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the attachment icon in the Messages tab to share a Drive file
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {driveAttachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                    >
                      {file.iconUrl ? (
                        <img src={file.iconUrl} alt="" className="h-6 w-6 shrink-0" />
                      ) : (
                        <Paperclip className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1 text-sm truncate">{file.name}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card data-slot="card">
            <CardContent className="p-6">
              <TaskActivityFeed entries={auditLog} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
