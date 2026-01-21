// Task Detail View - Pure presentational component
import Link from 'next/link'
import { TaskWithUsers, TaskMessageWithSender, TaskNoteWithAuthor, Visibility, TaskStatus, TaskPriority } from '@/lib/types'
import { STATUS_CONFIG, PRIORITY_CONFIG, VISIBILITY_LABELS } from '@/lib/constants'
import { formatDateTime, formatRelative } from '@/lib/utils/date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  ArrowLeft,
  Send,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  PauseCircle,
  Play,
  Trash2,
  StickyNote,
  MessageSquare,
  Eye,
  Lock,
} from 'lucide-react'
import type { UseDialogReturn } from '@/hooks/use-dialog'

interface TaskDetailViewProps {
  task: TaskWithUsers
  messages: TaskMessageWithSender[]
  notes: TaskNoteWithAuthor[]
  isAssigner: boolean
  isAssignee: boolean
  isParticipant: boolean
  newMessage: string
  setNewMessage: (value: string) => void
  newNote: string
  setNewNote: (value: string) => void
  noteVisibility: Visibility
  setNoteVisibility: (value: Visibility) => void
  onHoldReason: string
  setOnHoldReason: (value: string) => void
  deleteDialog: UseDialogReturn
  onHoldDialog: UseDialogReturn
  sendingMessage: boolean
  addingNote: boolean
  updatingStatus: boolean
  deleting: boolean
  onSendMessage: () => void
  onAddNote: () => void
  onStatusChange: (status: string) => void
  onOnHoldConfirm: () => void
  onDelete: () => void
  onArchive: () => void
}

export function TaskDetailView({
  task,
  messages,
  notes,
  isAssigner,
  isAssignee,
  isParticipant,
  newMessage,
  setNewMessage,
  newNote,
  setNewNote,
  noteVisibility,
  setNoteVisibility,
  onHoldReason,
  setOnHoldReason,
  deleteDialog,
  onHoldDialog,
  sendingMessage,
  addingNote,
  updatingStatus,
  deleting,
  onSendMessage,
  onAddNote,
  onStatusChange,
  onOnHoldConfirm,
  onDelete,
  onArchive,
}: TaskDetailViewProps) {
  const statusConfig = STATUS_CONFIG[task.status as TaskStatus]
  const priorityConfig = PRIORITY_CONFIG[task.priority as TaskPriority]

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/tasks" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className={statusConfig.color}>{statusConfig.label}</Badge>
              <Badge variant="secondary" className={priorityConfig.badgeColor}>
                {priorityConfig.label} priority
              </Badge>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{task.title}</h1>
          </div>

          {/* Actions */}
          {isAssigner && task.status !== 'archived' && (
            <div className="flex items-center gap-2">
              {task.status === 'pending' && (
                <Button onClick={() => onStatusChange('in_progress')} disabled={updatingStatus}>
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              )}
              {task.status === 'in_progress' && (
                <>
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
                        <DialogDescription>Optionally provide a reason</DialogDescription>
                      </DialogHeader>
                      <Textarea
                        placeholder="Reason for holding..."
                        value={onHoldReason}
                        onChange={(e) => setOnHoldReason(e.target.value)}
                      />
                      <DialogFooter>
                        <Button variant="outline" onClick={onHoldDialog.closeDialog}>Cancel</Button>
                        <Button onClick={onOnHoldConfirm}>Confirm</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button onClick={onArchive} disabled={updatingStatus}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                </>
              )}
              {task.status === 'on_hold' && (
                <Button onClick={() => onStatusChange('in_progress')} disabled={updatingStatus}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}
              <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.toggleDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
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
            </div>
          )}
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
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned to</p>
                  <p className="font-medium">{task.assignee?.name}</p>
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
                          <span className="text-xs text-muted-foreground">{formatRelative(msg.created_at)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
              <Separator className="my-4" />
              <div className="flex gap-2">
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
                        {note.visibility === 'private' ? <Lock className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                        {VISIBILITY_LABELS[note.visibility as Visibility]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatRelative(note.created_at)}</span>
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
                <div className="flex items-center justify-between">
                  <Select value={noteVisibility} onValueChange={(v) => setNoteVisibility(v as Visibility)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">{VISIBILITY_LABELS.private}</SelectItem>
                      <SelectItem value="supervisor">{VISIBILITY_LABELS.supervisor}</SelectItem>
                      <SelectItem value="hierarchy_same">{VISIBILITY_LABELS.hierarchy_same}</SelectItem>
                      <SelectItem value="hierarchy_above">{VISIBILITY_LABELS.hierarchy_above}</SelectItem>
                      <SelectItem value="all">{VISIBILITY_LABELS.all}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={onAddNote} disabled={addingNote || !newNote.trim()}>
                    Add Note
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
