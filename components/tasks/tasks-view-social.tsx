'use client'

import { useState } from 'react'
import { Plus, Search, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { SwipeableTaskCard } from './swipeable-task-card'
import { CreateTaskDrawer } from './create-task-drawer'
import type { TaskWithUsers, TaskStatus as TaskStatusType } from '@/lib/types'

type FilterType = 'all' | 'assigned' | 'created'

interface TasksViewSocialProps {
  tasks: TaskWithUsers[]
  isLoading: boolean
  searchQuery: string
  statusFilter: TaskStatusType | 'all'
  typeFilter: FilterType
  onSearchChange: (query: string) => void
  onStatusFilterChange: (status: TaskStatusType | 'all') => void
  onTypeFilterChange: (type: FilterType) => void
  onStatusChange?: (taskId: string, status: string) => void
  onDelete?: (taskId: string) => void
  currentUserId?: string
}

export function TasksViewSocial({
  tasks,
  isLoading,
  searchQuery,
  statusFilter,
  typeFilter,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onStatusChange,
  onDelete,
  currentUserId,
}: TasksViewSocialProps) {
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const filterOptions = [
    { value: 'all', label: 'All Tasks', emoji: '📋' },
    { value: 'assigned', label: 'Assigned to me', emoji: '👤' },
    { value: 'created', label: 'Created by me', emoji: '✍️' },
  ]

  const statusOptions = [
    { value: 'all', label: 'All Status', emoji: '🔄' },
    { value: 'pending', label: 'Not Started', emoji: '⏸️' },
    { value: 'in_progress', label: 'In Progress', emoji: '⚡' },
    { value: 'on_hold', label: 'On Hold', emoji: '⏸' },
    { value: 'archived', label: 'Completed', emoji: '✅' },
  ]

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header - Mobile First */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-card sticky top-16 lg:top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl font-bold flex-1">Tasks</h1>

          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-9 w-9 rounded-full relative',
                  activeFilterCount > 0 && 'bg-primary/10'
                )}
              >
                <Filter className="h-5 w-5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center font-medium">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Show</label>
                  <div className="space-y-2">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onTypeFilterChange(option.value as FilterType)
                          setShowFilters(false)
                        }}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl text-left transition-all',
                          'border flex items-center gap-3',
                          typeFilter === option.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted'
                        )}
                      >
                        <span className="text-xl">{option.emoji}</span>
                        <span className="font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <div className="space-y-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onStatusFilterChange(option.value as TaskStatusType | 'all')
                          setShowFilters(false)
                        }}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl text-left transition-all',
                          'border flex items-center gap-3',
                          statusFilter === option.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted'
                        )}
                      >
                        <span className="text-xl">{option.emoji}</span>
                        <span className="font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                {activeFilterCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onTypeFilterChange('all')
                      onStatusFilterChange('all')
                      setShowFilters(false)
                    }}
                    className="w-full rounded-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Button
            size="icon"
            onClick={() => setShowCreateDrawer(true)}
            className="h-9 w-9 rounded-full"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Active Filters Pills */}
        {activeFilterCount > 0 && (
          <div className="flex gap-2 mt-3">
            {typeFilter !== 'all' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
                <span>
                  {filterOptions.find((o) => o.value === typeFilter)?.label}
                </span>
                <button
                  onClick={() => onTypeFilterChange('all')}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {statusFilter !== 'all' && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs">
                <span>
                  {statusOptions.find((o) => o.value === statusFilter)?.label}
                </span>
                <button
                  onClick={() => onStatusFilterChange('all')}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'No tasks match your search'
                : 'Create your first task to get started'}
            </p>
            <Button
              onClick={() => setShowCreateDrawer(true)}
              className="rounded-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        ) : (
          tasks.map((task) => (
            <SwipeableTaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>

      {/* Floating Action Button - Alternative */}
      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-20">
        <Button
          size="lg"
          onClick={() => setShowCreateDrawer(true)}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Create Task Drawer */}
      <CreateTaskDrawer open={showCreateDrawer} onOpenChange={setShowCreateDrawer} />
    </div>
  )
}
