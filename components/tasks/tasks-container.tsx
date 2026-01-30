'use client';

// Tasks Container - Logic and data fetching layer
import { useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTasks } from '@/hooks';
import { TasksView } from './tasks-view';
import { DashboardLayout } from '@/components/layout';
import { TaskStatus } from '@/lib/types';

type FilterType = 'all' | 'assigned' | 'created';

export function TasksContainer() {
    const { effectiveUser } = useAuth();
    const { data: tasks = [], isLoading } = useTasks();

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<FilterType>('all');

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!task.title.toLowerCase().includes(query) &&
                    !task.description?.toLowerCase().includes(query)) {
                    return false;
                }
            }

            // Status filter
            if (statusFilter !== 'all' && task.status !== statusFilter) {
                return false;
            }

            // Type filter
            if (typeFilter === 'assigned' && !task.assignees?.some(a => a.id === effectiveUser?.id)) {
                return false;
            }
            if (typeFilter === 'created' && task.assigned_by !== effectiveUser?.id) {
                return false;
            }

            return true;
        });
    }, [tasks, searchQuery, statusFilter, typeFilter, effectiveUser?.id]);

    return (
        <DashboardLayout>
            <TasksView
                tasks={filteredTasks}
                isLoading={isLoading}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                typeFilter={typeFilter}
                onSearchChange={setSearchQuery}
                onStatusFilterChange={setStatusFilter}
                onTypeFilterChange={setTypeFilter}
            />
        </DashboardLayout>
    );
}
