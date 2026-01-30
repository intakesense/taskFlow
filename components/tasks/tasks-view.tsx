'use client'

// Tasks View - Pure presentational component
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { TaskWithUsers, TaskStatus as TaskStatusType } from '@/lib/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants';
import { formatDateShort } from '@/lib/utils/date';
import { taskCardVariants, listContainerVariants } from '@/lib/animations';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Calendar, User, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Types
type FilterType = 'all' | 'assigned' | 'created';

interface TasksViewProps {
    tasks: TaskWithUsers[];
    isLoading: boolean;
    searchQuery: string;
    statusFilter: TaskStatusType | 'all';
    typeFilter: FilterType;
    onSearchChange: (query: string) => void;
    onStatusFilterChange: (status: TaskStatusType | 'all') => void;
    onTypeFilterChange: (type: FilterType) => void;
}

// Subcomponents
function StatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    return <Badge variant="outline" className={config.color}>{config.label}</Badge>;
}

function PriorityDot({ priority }: { priority: string }) {
    const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.low;
    return <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />;
}

function TaskCard({ task, index }: { task: TaskWithUsers; index: number }) {
    const prefersReducedMotion = useReducedMotion();

    return (
        <m.div
            layout
            variants={prefersReducedMotion ? undefined : taskCardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover={prefersReducedMotion ? undefined : "hover"}
            whileTap={prefersReducedMotion ? undefined : "tap"}
            custom={index}
        >
            <Link href={`/tasks/${task.id}`}>
                <Card className="bg-card/50 border-border hover:bg-card transition-colors cursor-pointer group" data-slot="card">
                    <CardContent className="p-4 lg:p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <PriorityDot priority={task.priority} />
                                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                        {task.title}
                                    </h3>
                                </div>
                                {task.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                                        {task.description}
                                    </p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <User className="h-4 w-4" />
                                        <span>From: {task.assigner?.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <span>To: {task.assignees?.length === 1
                                            ? task.assignees[0].name
                                            : task.assignees?.length
                                                ? `${task.assignees.length} people`
                                                : 'Unassigned'}</span>
                                    </div>
                                    {task.deadline && (
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            <span>{formatDateShort(task.deadline)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={task.status} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </m.div>
    );
}

// Main View
export function TasksView({
    tasks,
    isLoading,
    searchQuery,
    statusFilter,
    typeFilter,
    onSearchChange,
    onStatusFilterChange,
    onTypeFilterChange,
}: TasksViewProps) {
    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Tasks</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage and track all your tasks
                    </p>
                </div>
                <Link href="/tasks/new">
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" />
                        New Task
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <Card className="bg-card/50 border-border" data-slot="card">
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <Tabs value={typeFilter} onValueChange={(v) => onTypeFilterChange(v as FilterType)}>
                            <TabsList>
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="assigned">Assigned to me</TabsTrigger>
                                <TabsTrigger value="created">Created by me</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as TaskStatusType | 'all')}>
                            <TabsList>
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="pending">Pending</TabsTrigger>
                                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                                <TabsTrigger value="archived">Completed</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardContent>
            </Card>

            {/* Task List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : tasks.length === 0 ? (
                <Card className="bg-card/50 border-border" data-slot="card">
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">No tasks found</p>
                        <Link href="/tasks/new" className="mt-4 inline-block">
                            <Button variant="outline" className="mt-2">
                                <Plus className="h-4 w-4 mr-2" />
                                Create your first task
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <m.div
                    className="grid gap-4"
                    variants={listContainerVariants}
                    initial="initial"
                    animate="animate"
                >
                    <AnimatePresence mode="popLayout">
                        {tasks.map((task, index) => (
                            <TaskCard key={task.id} task={task} index={index} />
                        ))}
                    </AnimatePresence>
                </m.div>
            )}
        </div>
    );
}
